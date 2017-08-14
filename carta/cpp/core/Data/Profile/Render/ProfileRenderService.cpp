#include "ProfileRenderService.h"
#include "ProfileRenderWorker.h"
#include "ProfileRenderThread.h"
#include "ProfileRenderRequest.h"
#include "Data/Image/Layer.h"
#include "Data/Region/Region.h"
#include "CartaLib/Hooks/ProfileHook.h"

namespace Carta {
namespace Data {

ProfileRenderService::ProfileRenderService( QObject * parent ) :
        QObject( parent ),
        m_worker( nullptr),
        m_renderThread( nullptr ){
    m_renderQueued = false;
}


bool ProfileRenderService::renderProfile(std::shared_ptr<Layer> layer,
        std::shared_ptr<Region> region, const Carta::Lib::ProfileInfo& profInfo,
        bool createNew ){
    bool profileRender = true;
    ProfileRenderRequest request( layer, region, profInfo, createNew );
    if ( layer ){
    	if ( ! m_requests.contains( request ) ){
    		m_requests.enqueue( request );
    		_scheduleRender( layer, region, profInfo );
    	}
    }
    else {
        profileRender = false;
    }
    return profileRender;
}


void ProfileRenderService::_scheduleRender( std::shared_ptr<Layer> layer,
        std::shared_ptr<Region> region, const Carta::Lib::ProfileInfo& profInfo){
    if ( m_renderQueued ) {
        return;
    }

    // This part are used to check whether the image is proper.
    // (1) To trigger propiler, the image should be a RA-DEC-Channel/Tabular cube
    //     or Linear-Linear-Channel/Tabular cube.
    // (2) For a 4-dim cube, Stokes should be set up first.
    // (3) The axes of gridline should be RA-DEC plane or Linear-Linear plane.
    // The check of the spectral/tabular axis is in ProfileCASA.
    auto xType = layer->_getAxisXType();
    auto yType = layer->_getAxisYType();
    bool isRADECPlane = false;
    bool isDualLiPlane = false;
    // check the plane.
    if ( xType == Carta::Lib::AxisInfo::KnownType::DIRECTION_LON || xType == Carta::Lib::AxisInfo::KnownType::DIRECTION_LAT ){
        if ( yType == Carta::Lib::AxisInfo::KnownType::DIRECTION_LON || yType == Carta::Lib::AxisInfo::KnownType::DIRECTION_LAT ){
            isRADECPlane = true;
        }
    }
    if (xType == Carta::Lib::AxisInfo::KnownType::LINEAR && yType == Carta::Lib::AxisInfo::KnownType::LINEAR ){
        isDualLiPlane = true;
    }
    if ( !(isRADECPlane||isDualLiPlane) ){
        qWarning() << "The displayed plane is not RA-DEC or Linear-Linear.";
        Carta::Lib::Hooks::ProfileResult result;
        ProfileRenderRequest request = m_requests.dequeue();
        emit profileResult(result, request.getLayer(), request.getRegion(), request.isCreateNew() );
        return;
    }

    m_renderQueued = true;


    //Create a worker if we don't have one.
    if ( !m_worker ){
        m_worker = new ProfileRenderWorker();
    }

    if ( !m_renderThread ){
        m_renderThread = new ProfileRenderThread();
        connect( m_renderThread, SIGNAL(finished()),
                this, SLOT( _postResult()));
    }
    std::shared_ptr<Carta::Lib::Regions::RegionBase> regionInfo(nullptr);
    if ( region ){
        regionInfo = region->getModel();
    }
    std::shared_ptr<Carta::Lib::Image::ImageInterface> dataSource = layer->_getImage();
    m_worker->setParameters( dataSource, regionInfo, profInfo );
    int pid = m_worker->computeProfile();
    if ( pid != -1 ){
        m_renderThread->setFileDescriptor( pid );
        m_renderThread->start();
    }
    else {
        m_renderQueued = false;
    }
}

void ProfileRenderService::_postResult(  ){
    Lib::Hooks::ProfileResult result = m_renderThread->getResult();
    ProfileRenderRequest request = m_requests.dequeue();
    emit profileResult(result, request.getLayer(), request.getRegion(), request.isCreateNew() );
    m_renderQueued = false;
    if ( m_requests.size() > 0 ){
        ProfileRenderRequest& head = m_requests.head();
         _scheduleRender( head.getLayer(), head.getRegion(), head.getProfileInfo() );
    }
}


ProfileRenderService::~ProfileRenderService(){
    delete m_worker;
    delete m_renderThread;
}
}
}
