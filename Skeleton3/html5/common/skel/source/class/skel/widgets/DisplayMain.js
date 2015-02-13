/**
 * Created with IntelliJ IDEA.
 * User: pfederl
 * Date: 05/04/13
 * Time: 4:27 PM
 * To change this template use File | Settings | File Templates.
 */

/*global mImport */
/*******************************************************************************
 * @ignore( mImport)
 ******************************************************************************/

qx.Class.define("skel.widgets.DisplayMain",
{
    extend : qx.ui.container.Composite,

    construct : function() {
        this.base(arguments, new qx.ui.layout.Grow());
        this._initSharedVariables();

        this.addListener("appear", function() {
            var bounds = this.getBounds();
            this.m_height = bounds.height;
            this.m_width = bounds.width;
            
            this._resetLayoutCB();
            this.addListener("resize", function() {
                // this._resizeContent();
                var bounds = this.getBounds();
                this.m_height = bounds.height;
                
                this.m_width = bounds.width;
                var sizeData = {
                        "offsetX" : bounds.left,
                        "offsetY" : bounds.top
                    };
                qx.event.message.Bus.dispatch(new qx.event.message.Message(
                        "mainOffsetsChanged", sizeData));
            }, this);
        }, this);
        
        qx.event.message.Bus.subscribe("setView", function(
                message) {
            var data = message.getData();
            this._setView(data.plugin, data.row, data.col);
        }, this);

    },

    events : {
        "iconifyWindow" : "qx.event.type.Data",
        "addWindowMenu" : "qx.event.type.Data",
        "layoutGrid" : "qx.event.type.Data"
    },

    members : {
        
        
        /**
         * Send a command to the server to clear the layout.
         */
        _clearLayout : function(){
            this._removeWindows();
            var path = skel.widgets.Path.getInstance();
            var clearLayoutCmd = path.getCommandClearLayout();
            this.m_connector.sendCommand(clearLayoutCmd, "", function(){});
        },

        /**
         * Load the data identified by the path.
         * @param path {String} an identifier for data to be displayed.
         */
        dataLoaded : function(path) {
            if (this.m_pane !== null) {
                this.m_pane.dataLoaded(path);
            }
        },

        /**
         * Unload the data identified by the path.
         * @param path {String} an identifier for data to be removed.
         */
        dataUnloaded : function(path) {
            if (this.m_pane !== null) {
                this.m_pane.dataUnloaded(path);
            }
        },
        
        _drawModeChanged : function(ev) {
            if (this.m_pane !== null) {
                this.m_pane.setDrawMode(ev.getData());
            }
        },
        
        /**
         * Returns a list of information concerning windows that can be linked to
         * the given source window showing the indicated plug-in.
         * @param pluginId {String} the name of the plug-in.
         * @param sourceId {String} an identifier for the window displaying the
         *      plug-in that wants information about the links that can originate from it.
         * @return {String} information about links that can be established from the specified
         *      window/plug-in.
         */
        getLinkInfo : function(pluginId, sourceId) {
            var linkInfo = [];
            if (this.m_pane !== null) {
                linkInfo = this.m_pane.getLinkInfo(pluginId, sourceId);
            }
            return linkInfo;
        },

        /**
         * Initialize the state variables.
         */
        _initSharedVariables : function() {
            this.m_connector = mImport("connector");

            // row & columns of layout
            var pathDict = skel.widgets.Path.getInstance();
            this.m_layout = this.m_connector.getSharedVar( pathDict.LAYOUT );
            this.m_layout.addCB( this._resetLayoutCB.bind(this));
        },
        
        
        
        /**
         * Layout the screen real estate using a square grid
         * with the indicated number of rows and columns.
         * 
         * @param rows {Number} the number of rows in the grid.
         * @param cols {Number} the number of columns in the grid.
         */
        layout : function(rows, cols) {
            if (rows >= 1 && cols >= 1) {
                if ( this.m_pane !== null ){
                    var area = this.m_pane.getDisplayArea();
                    if ( this.indexOf( area ) >= 0 ){
                        this.remove( area );
                    }
                }
                var splitterSize = 10;
                var splitterHeight = this.m_height - (this.m_gridRowCount - 1)* splitterSize;
                var splitterWidth = this.m_width - (this.m_gridColCount - 1)* splitterSize;
                this.m_pane = new skel.widgets.DisplayArea(rows, cols, splitterHeight, splitterWidth, 0, 0, cols - 1);
                this.m_pane.addListener("iconifyWindow",
                        function(ev) {
                            this.fireDataEvent("iconifyWindow",ev.getData());
                        }, this);

                qx.event.message.Bus.subscribe("addLink", function(ev){
                    var data = ev.getData();
                    this.link( data.source, data.destination, true );
                }, this );
                qx.event.message.Bus.subscribe( "clearLinks", function(ev){
                    console.log( "Clearing links needs to be implemented");
                }, this);
                qx.event.message.Bus.subscribe("drawModeChanged", this._drawModeChanged, this);
                qx.event.message.Bus.subscribe(
                                "windowSelected",
                                function(message) {
                                    var selectedWindow = message.getData();
                                    this.m_pane.windowSelected(selectedWindow);
                                    var menuButtons = selectedWindow.getWindowMenu();
                                    this.fireDataEvent("addWindowMenu",menuButtons);
                                }, this);

                var displayArea = this.m_pane.getDisplayArea();

                this.add(displayArea);
               
            }
        },

        /**
         * Adds or removes the link from the window identified
         * by the sourceWinId to the window identified by the
         * destWinId.
         * 
         * @param sourceWinId
         *                {String} an identifier for the window
         *                representing the source of the link.
         * @param destWinId
         *                {String} an identifier for the window
         *                representing the destination of the
         *                link.
         * @param addLink
         *                {boolean} true if the link should be
         *                added; false otherwise.
         */
        link : function(sourceWinId, destWinId, addLink) {
            if (this.m_pane !== null) {
                this.m_pane.changeLink(sourceWinId, destWinId,addLink);
            }
        },

        /**
         * Restore the window at the given layout position to its original location.
         * @param row {Number} the row index of the window to be restored.
         * @param col {Number} the column index of the window to be restored.
         */
        restoreWindow : function(row, col) {
            this.m_pane.restoreWindow(row, col);
        },

        /**
         * Clears out the existing windows.
         */
        _removeWindows : function() {
            if (this.m_pane !== null) {
                this.m_pane.removeWindows();
                this.removeAll();
            }
        },
        
        /**
         * Returns the first window in the list displaying the plug-in or null if none
         * exists.
         * @param plugin {String} a plug-in identifier.
         * @param windows {Array} a list of windows.
         * @return {skel.widgets.Window.DisplayWindow} the first window displaying the plug-in
         *      or null if no such plug-in exists.
         */
        _findWindow : function( plugin, windows ){
            var window = null;
            for ( var i = 0; i < windows.length; i++ ){
                if ( windows[i].getPlugin() === plugin ){
                    window = windows[i];
                    windows.splice( i, 1 );
                    break;
                }
            }
            return window;
        },

        /**
         * Resets which plugins are displayed in each window.
         * @param layoutObj {Object} information about the plug-ins that
         *      should be displayed.
         */
        _resetDisplayedPlugins : function( layoutObj, windows ) {
            var index = 0;
            var pluginMap = {};
            for (var row = 0; row < this.m_gridRowCount; row++) {
                for (var col = 0; col < this.m_gridColCount; col++) {
                    var name = layoutObj.plugins[index];
                    if ( name && typeof(name) == "string" && name.length > 0 ){
                        if ( name != skel.widgets.Window.DisplayWindow.EXCLUDED ){
                            if ( pluginMap[name] ===undefined ){
                                pluginMap[name] = -1;
                            }
                            pluginMap[name] = pluginMap[name] + 1;
                            var window = this._findWindow ( name, windows );
                            if ( window === null ){
                                this.m_pane.setView(name, pluginMap[name], row, col);
                            }
                            else {
                                this.m_pane.setWindow( window, row, col );
                            }
                        }
                        else {
                            this.m_pane.excludeArea( row, col );
                        }
                    }
                    else {
                        this.m_pane.setView( null, -1, row, col );
                    }
                    index++;
                }
            }
        },
        
        /**
         * Reset the layout based on changed row and column
         * counts.
         */
        _resetLayoutCB : function() {
            var layoutObjJSON = this.m_layout.get();
            if ( layoutObjJSON ){
                try {
                    var layout = JSON.parse( layoutObjJSON );
                    if ( layout.rows > 0 && layout.cols > 0 ){
                        var windows = [];
                        if ( this.m_pane !== null ){
                            windows = this.m_pane.getWindows();
                        }
                        if ( layout.rows != this.m_gridRowCount || layout.cols != this.m_gridColCount ){
                            this.m_gridRowCount = layout.rows;
                            this.m_gridColCount = layout.cols;
                            var gridData = {
                                    "rows" : this.m_gridRowCount,
                                    "cols" : this.m_gridColCount
                                };
                            qx.event.message.Bus.dispatch(new qx.event.message.Message(
                                    "layoutGrid", gridData));
                            this.layout(this.m_gridRowCount, this.m_gridColCount);
                        }
                        this._resetDisplayedPlugins( layout, windows );
                    }
                }
                catch( err ){
                    console.log( "Could not parse: "+layoutObjJSON );
                }
            }
        },
        
       
        
        /**
         * Update the number of rows in the current layout.
         * @param gridRows {Number} the number of rows in the layout.
         */
        setRowCount : function(gridRows) {
            if ( this.m_gridRowCount != gridRows ){
                //this._clearLayout();
                var path = skel.widgets.Path.getInstance();
                var layoutSizeCmd = path.getCommandSetLayoutSize();
                var params = "rows:"+gridRows + ",cols:"+this.m_gridColCount;
                this.m_connector.sendCommand( layoutSizeCmd, params, function(){});
            }
        },

        /**
         * Update the number of columns in the current layout.
         * @param gridCols {Number} the number of columns in the layout.
         */
        setColCount : function(gridCols) {
            if ( this.m_gridColCount != gridCols ){
                //this._clearLayout();
                var path = skel.widgets.Path.getInstance();
                var layoutSizeCmd = path.getCommandSetLayoutSize();
                var params = "rows:"+this.m_gridRowCount + ",cols:"+gridCols;
                this.m_connector.sendCommand( layoutSizeCmd, params, function(){});
            }
        },
        
        /**
         * Set the shared variables that store the plugins that will be displayed
         * in each cell.
         */
        
        _setPlugins : function(){
            var path = skel.widgets.Path.getInstance();
            var cmd = path.getCommandSetPlugin();
            var params = "names:";
            for( var i = 0; i < arguments.length; i++ ){
                params = params + arguments[i];
                if ( i != arguments.length - 1 ){
                    params = params + ".";
                }
            }
            this.m_connector.sendCommand( cmd, params, function(){} );
        },
        
        /**
         * Sends a command to the server letting it now that the displayed plugin
         * has changed.
         * @param plugin {String} the name of the new plugin.
         * @param row {Number} the row index of the window containing the plugin.
         * @param col {Number} the column index of the window containing the plugin.
         */
        _setView : function( plugin, row, col ){
            var path = skel.widgets.Path.getInstance();
            var layoutPath = path.LAYOUT;
            var layoutSharedVar = this.m_connector.getSharedVar(layoutPath);
            var val = layoutSharedVar.get();
            if ( val ){
                try {
                    var layoutObj = JSON.parse( val );
                    var index = row * this.m_gridColCount + col;
                    var cmd = path.getCommandSetPlugin();
                    var params = "names:";
                    var i = 0;
                    for( var r = 0; r < this.m_gridRowCount; r++ ){
                        for ( var c = 0; c < this.m_gridColCount; c++ ){
                            if ( i != index ){
                                if ( typeof(layoutObj.plugins[i]) =="string" ){
                                    params = params + layoutObj.plugins[i];
                                }
                            }
                            else {
                                params = params + plugin;
                            }
                            if ( i != this.m_gridRowCount * this.m_gridColCount - 1 ){
                                params = params + ".";
                            }
                            i++;
                        }
                    }
                    this.m_connector.sendCommand( cmd, params, function(){} );
                }
                catch( err ){
                    console.log( "Could not parse: "+val );
                }
            }
        },

        m_PLUGIN_PREFIX : "win",
        
        m_pane : null,
        m_height : 0,
        m_width : 0,
        m_gridRowCount : null,
        m_gridColCount : null,

        //State variables
        m_layout : null,

        m_connector : null
    },

    properties : {
        appearance : {
            refine : true,
            init : "display-main"
        }
    }

});
