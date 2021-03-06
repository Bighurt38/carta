#include "PCacheSqlite3.h"
#include "CartaLib/Hooks/GetPersistentCache.h"
#include <QDebug>
#include <QtSql>
#include <QDir>

typedef Carta::Lib::Hooks::GetPersistentCache GetPersistentCacheHook;

///
/// Implementation of IPCache using sqlite
///
class SqLitePCache : public Carta::Lib::IPCache
{
public:

    virtual uint64_t
    maxStorage() override
    {
        return 1;
    }

    virtual uint64_t
    usedStorage() override
    {
        return 1;
    }

    virtual uint64_t
    nEntries() override
    {
        return 1;
    }

    virtual void
    deleteAll() override
    {
        if ( ! m_db.isOpen() ) {
            return;
        }
        QSqlQuery query( m_db );
        query.prepare( "DELETE FROM db;" );

        if ( ! query.exec() ) {
            qWarning() << "Delete query failed.";
        }
    } // deleteAll

    virtual bool
    readEntry( const QByteArray & key, QByteArray & val ) override
    {
        if ( ! m_db.isOpen() ) {
            return false;
        }
        QSqlQuery query( m_db );
        query.prepare( "SELECT val FROM db WHERE key = :key" );
        query.bindValue( ":key", key );

        if ( ! query.exec() ) {
            qWarning() << "Select query failed.";
            return false;
        }
        if ( query.next() ) {
            val = query.value( 0 ).toByteArray();
            return true;
        }
        return false;
    } // readEntry

    virtual void
    setEntry( const QByteArray & key, const QByteArray & val, int64_t priority ) override
    {
        if ( ! m_db.isOpen() ) {
            return;
        }

        Q_UNUSED( priority );
        QSqlQuery query( m_db );
        query.prepare( "INSERT OR REPLACE INTO db (key, val) VALUES ( :key, :val)" );

        query.bindValue( ":key", key );
        query.bindValue( ":val", val );

        if ( ! query.exec() ) {
            qWarning() << "Insert query failed:" << query.lastError().text();
        }
    } // setEntry

    static
    Carta::Lib::IPCache::SharedPtr
    getCacheSingleton( QString dirPath)
    {
        if ( m_cachePtr ) {
            qCritical() << "PCacheSQlite3Plugin::Calling GetPersistentCacheHook multiple times!!!";
        }
        else {
            m_cachePtr.reset( new SqLitePCache( dirPath) );
        }
        return m_cachePtr;
    }

    virtual void Release() override
    {
        m_cachePtr = nullptr;
    }

    ~SqLitePCache()
    {
        m_db.close();
    }

private:

    SqLitePCache( QString dirPath)
    {
        m_db = QSqlDatabase::addDatabase( "QSQLITE" );

        m_db.setDatabaseName( dirPath );
        bool ok = m_db.open();
        if ( ! ok ) {
            qCritical() << "Could not open sqlite database at location" << dirPath;
        }

        QSqlQuery query( m_db );

        query.prepare( "CREATE TABLE IF NOT EXISTS db (key TEXT PRIMARY KEY, val BLOB)" );

        if ( ! query.exec() ) {
            qCritical() << "Create table query failed:" << query.lastError().text();
        }
    }

private:

    QSqlDatabase m_db;
    static Carta::Lib::IPCache::SharedPtr m_cachePtr; //  = nullptr;
};

Carta::Lib::IPCache::SharedPtr SqLitePCache::m_cachePtr = nullptr;

PCacheSQlite3Plugin::PCacheSQlite3Plugin( QObject * parent ) :
    QObject( parent )
{ }

bool
PCacheSQlite3Plugin::handleHook( BaseHook & hookData )
{
    // we only handle one hook: get the cache object
    if ( hookData.is < GetPersistentCacheHook > () ) {
        // decode hook data
        GetPersistentCacheHook & hook = static_cast < GetPersistentCacheHook & > ( hookData );

        // if no dbdir was specified, refuse to work :)
        if( m_dbPath.isNull()) {
            hook.result.reset();
            return false;
        }

        // try to create the database
        hook.result = SqLitePCache::getCacheSingleton( m_dbPath);

        // return true if result is not null
        return hook.result != nullptr;
    }

    qWarning() << "PCacheSQlite3Plugin: Sorry, don't know how to handle this hook.";
    return false;
} // handleHook

void
PCacheSQlite3Plugin::initialize( const IPlugin::InitInfo & initInfo )
{
    qDebug() << "PCacheSQlite3Plugin initializing...";
    QJsonDocument doc( initInfo.json );
    qDebug() << doc.toJson();

    // extract the location of the database from carta.config
    m_dbPath = initInfo.json.value( "dbPath").toString();
    if( m_dbPath.isNull()) {
        qCritical() << "No dbPath specified for PCacheSqlite3 plugin!!!";
    }
    else {
        // convert this to absolute path just in case
        m_dbPath = QDir(m_dbPath).absolutePath();
    }
}

std::vector < HookId >
PCacheSQlite3Plugin::getInitialHookList()
{
    return {
               GetPersistentCacheHook::staticId
    };
}
