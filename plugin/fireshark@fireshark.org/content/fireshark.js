/*

Copyright 2007-2010 Stephan Chenette

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

var EXPORTED_SYMBOLS = ['Fireshark'];

Components.utils.import("resource://content/utils.js");
Components.utils.import("resource://content/logmanager.js");
Components.utils.import("resource://content/netmonitor.js");
Components.utils.import("resource://content/jsmonitor.js");
Components.utils.import("resource://content/domobserver.js");
Components.utils.import("resource://content/contentmonitor.js");

var Fireshark = {
	
	init: function () {

		try {
		
			this.running = false;	
			this.requestStateCount = 0;
			this.responseStateCount = 0;

			this.params = {};

			this.urls = new Array();
			this.currenturl = '';

			this.callbacks = new Array();

			this.eventArray = new Array();

			// register event callback
			//LogManager.logToConsole("Fireshark:init() registering callback");
			this.registerCallback(this.firesharkEventCallback);

			this.clear();

		} catch(e) {

			LogManager.logToConsole(e);
		}
	},
	
	isRunning: function () {

		try {
		
			return this.running;	

		} catch(e) {

			LogManager.logToConsole(e);
			return false;
		}
	},
	
	verifyInputParams: function() {
	
		try {
			
			var _params = this.params;
			
			// required params are 
			// urls or urlFile
			
			// optional params are
			// httpReferrer, httpUserAgent, urlLoadTimout, saveLocation
			
			var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);
							
			// if no httpReferrer take system default
			if(!this.params.httpReferrer || this.params.httpReferrer.length == 0) {
				var sys_httpReferrer = prefManager.getCharPref("extensions.fireshark.options.default.httpReferrer");
				this.params.httpReferrer = {};
				this.params.httpReferrer = sys_httpReferrer;
			}
			
			// if no httpUserAgent take system default
			if(!this.params.httpUserAgent || this.params.httpUserAgent.length == 0) {
				var sys_httpUserAgent = prefManager.getCharPref("extensions.fireshark.options.default.httpUserAgent");
				this.params.httpUserAgent = sys_httpUserAgent;
			}
			
			// if no  urlLoadTimout take system default
			if(!this.params.urlLoadTimeout || this.params.urlLoadTimeout.length == 0  || this.params.urlLoadTimeout <= 0) {
				var sys_uriLoadTimeout = prefManager.getIntPref("extensions.fireshark.options.default.uriLoadTimeout");
				this.params.urlLoadTimeout = sys_uriLoadTimeout;
			}
			
			// if no httpProxy take system default
			if(!this.params.httpProxy || this.params.httpProxy.length == 0) {
				var sys_httpProxy = prefManager.getCharPref("extensions.fireshark.options.default.httpProxy");
				this.params.httpProxy = sys_httpProxy;
			}
			
			// if no httpProxyPort take system default
			if(!this.params.httpProxyPort || this.params.httpProxyPort < 0 || this.params.ProxyPort > 65500) {
				var sys_httpProxyPort = prefManager.getIntPref("extensions.fireshark.options.default.httpProxyPort");
				this.params.httpProxyPort = sys_httpProxyPort;
			}
			
			// if no saveLocation take profile directory
			// Profile directory
			if(!this.params.saveLocation || this.params.saveLocation.length == 0) {
				var profileD = Components.classes["@mozilla.org/file/directory_service;1"].  
						getService(Components.interfaces.nsIProperties).  
							get("ProfD", Components.interfaces.nsIFile);  
				var profileDir = profileD.path;
				var sys_savePath = profileDir;
				this.params.saveLocation = sys_savePath;
			}
			
			// set the user-agent in all windows
			this.setUserAgent();
			
			// set the proxy in all windows
			this.setProxy();


		} catch(e) {
	
			LogManager.logToConsole("verifyInputParams caught an exception: " + e.name + ": " + e.message);
			return false;
		}
	
		return true;
	},

	setUserAgent: function() {

		try {
			var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);

		    if( prefManager.prefHasUserValue("general.useragent.appName") ) {
				var general_useragent_appName 	= prefManager.getCharPref("general.useragent.appName");
				prefManager.setCharPref("extensions.fireshark.archived.general.useragent.appName", general_useragent_appName);
			}
			
			if( prefManager.prefHasUserValue("general.appname.override") ) {
				var general_appname_override 	= prefManager.getCharPref("general.appname.override");
				prefManager.setCharPref("extensions.fireshark.archived.general.appname.override", general_appname_override);
			}
			
			if( prefManager.prefHasUserValue("general.appversion.override") ) {
				var general_appversion_override = prefManager.getCharPref("general.appversion.override");
				prefManager.setCharPref("extensions.fireshark.archived.general.appversion.override", general_appversion_override);
			}
			
			if( prefManager.prefHasUserValue("general.platform.override") ) {
				var general_platform_override 	= prefManager.getCharPref("general.platform.override");
				prefManager.setCharPref("extensions.fireshark.archived.general.platform.override", general_platform_override);
			}
			
			if( prefManager.prefHasUserValue("general.useragent.override") ) {
				var general_useragent_override 	= prefManager.getCharPref("general.useragent.override");
				prefManager.setCharPref("extensions.fireshark.archived.general.useragent.override", general_useragent_override);
			}
			
			if( prefManager.prefHasUserValue("general.useragent.vendor") ) {
				var general_useragent_vendor 	= prefManager.getCharPref("general.useragent.vendor");
				prefManager.setCharPref("extensions.fireshark.archived.general.useragent.vendor", general_useragent_vendor);
			}
			
			if( prefManager.prefHasUserValue("general.useragent.vendorSub") ) {
				var general_useragent_vendorSub = prefManager.getCharPref("general.useragent.vendorSub");
				prefManager.setCharPref("extensions.fireshark.archived.general.useragent.vendorSub", general_useragent_vendorSub);
			}
			
			prefManager.setCharPref("general.useragent.override", this.params.httpUserAgent);

		} catch(e) {
	
			LogManager.logToConsole("setUserAgent caught an exception: " + e.name + ": " + e.message);
		}
	},
	
	setProxy: function() {

		try {
		
		
			var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);

		    if( prefManager.prefHasUserValue("network.proxy.backup.ftp") ) {
				var network_proxy_backup_ftp 	= prefManager.getCharPref("network.proxy.backup.ftp");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.backup.ftp", network_proxy_backup_ftp);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.backup.ftp_port") ) {
				var network_proxy_backup_ftp_port 	= prefManager.getIntPref("network.proxy.backup.ftp_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.backup.ftp_port", network_proxy_backup_ftp_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.backup.gopher") ) {
				var network_proxy_backup_gopher 	= prefManager.getCharPref("network.proxy.backup.gopher");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.backup.gopher", network_proxy_backup_gopher);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.backup.gopher_port") ) {
				var network_proxy_backup_gopher_port 	= prefManager.getIntPref("network.proxy.backup.gopher_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.backup.gopher_port", network_proxy_backup_gopher_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.backup.socks") ) {
				var network_proxy_backup_socks 	= prefManager.getCharPref("network.proxy.backup.socks");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.backup.socks", network_proxy_backup_socks);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.backup.socks_port") ) {
				var network_proxy_backup_socks_port 	= prefManager.getIntPref("network.proxy.backup.socks_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.backup.socks_port", network_proxy_backup_socks_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.backup.ssl") ) {
				var network_proxy_backup_ssl 	= prefManager.getCharPref("network.proxy.backup.ssl");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.backup.ssl", network_proxy_backup_ssl);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.backup.ssl_port") ) {
				var network_proxy_backup_ssl_port 	= prefManager.getIntPref("network.proxy.backup.ssl_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.backup.ssl_port", network_proxy_backup_ssl_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.ftp") ) {
				var network_proxy_ftp 	= prefManager.getCharPref("network.proxy.ftp");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.ftp", network_proxy_ftp);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.ftp_port") ) {
				var network_proxy_ftp_port 	= prefManager.getIntPref("network.proxy.ftp_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.ftp_port", network_proxy_ftp_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.gopher") ) {
				var network_proxy_gopher 	= prefManager.getCharPref("network.proxy.gopher");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.gopher", network_proxy_gopher);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.gopher_port") ) {
				var network_proxy_gopher_port 	= prefManager.getIntPref("network.proxy.gopher_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.gopher_port", network_proxy_gopher_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.socks") ) {
				var network_proxy_socks 	= prefManager.getCharPref("network.proxy.socks");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.socks", network_proxy_socks);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.socks_port") ) {
				var network_proxy_socks_port 	= prefManager.getIntPref("network.proxy.socks_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.socks_port", network_proxy_socks_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.ssl") ) {
				var network_proxy_ssl 	= prefManager.getCharPref("network.proxy.ssl");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.ssl", network_proxy_ssl);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.ssl_port") ) {
				var network_proxy_ssl_port 	= prefManager.getIntPref("network.proxy.ssl_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.ssl_port", network_proxy_ssl_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.http") ) {
				var network_proxy_http 	= prefManager.getCharPref("network.proxy.http");
				prefManager.setCharPref("extensions.fireshark.archived.network.proxy.http", network_proxy_http);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.http_port") ) {
				var network_proxy_http_port 	= prefManager.getIntPref("network.proxy.http_port");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.http_port", network_proxy_http_port);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.share_proxy_settings") ) {
				var network_proxy_share_proxy_settings 	= prefManager.getBoolPref("network.proxy.share_proxy_settings");
				prefManager.setBoolPref("extensions.fireshark.archived.network.share_proxy_settings", network_proxy_share_proxy_settings);
			}
			
			if( prefManager.prefHasUserValue("network.proxy.type") ) {
				var network_proxy_type 	= prefManager.getIntPref("network.proxy.type");
				prefManager.setIntPref("extensions.fireshark.archived.network.proxy.type", network_proxy_type);
			}
			
			prefManager.setCharPref("network.proxy.http", this.params.httpProxy);
			prefManager.setIntPref("network.proxy.http_port", this.params.httpProxyPort);
			
			if(this.params.httpProxy != undefined && this.params.httpProxy.length > 0) {
				prefManager.setBoolPref("network.proxy.share_proxy_settings", true);
				prefManager.setIntPref("network.proxy.type", 1);
				
			} else {
				prefManager.setBoolPref("network.proxy.share_proxy_settings", false);
				prefManager.setIntPref("network.proxy.type", 0);
			}

		} catch(e) {
	
			LogManager.logToConsole("setProxy caught an exception: " + e.name + ": " + e.message);
		}
	},
	
	revertUserAgent: function() {

		try {
			var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);

			if( prefManager.prefHasUserValue("extensions.fireshark.archived.general.useragent.appName") ) {
			 var general_useragent_appName = prefManager.getCharPref("extensions.fireshark.archived.general.useragent.appName");
			 prefManager.setCharPref("general.useragent.appName", general_useragent_appName);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.general.appname.override") ) {
			 var general_appname_override = prefManager.getCharPref("extensions.fireshark.archived.general.appname.override");
			 prefManager.setCharPref("general.appname.override", general_appname_override);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.general.appversion.override") ) {
			 var general_appversion_override = prefManager.getCharPref("extensions.fireshark.archived.general.appversion.override");
			 prefManager.setCharPref("general.appversion.override", general_appversion_override);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.general.platform.override") ) {
			 var general_platform_override = prefManager.getCharPref("extensions.fireshark.archived.general.platform.override");
			 prefManager.setCharPref("general.platform.override", general_platform_override);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.general.useragent.override") ) {
			 var general_useragent_override = prefManager.getCharPref("extensions.fireshark.archived.general.useragent.override");
			 prefManager.setCharPref("general.useragent.override", general_useragent_override);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.general.useragent.vendor") ) {
			 var general_useragent_vendor = prefManager.getCharPref("extensions.fireshark.archived.general.useragent.vendor");
			 prefManager.setCharPref("general.useragent.vendor", general_useragent_vendor);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.general.useragent.vendorSub") ) {
			 var general_useragent_vendorSub = prefManager.getCharPref("extensions.fireshark.archived.general.useragent.vendorSub");
			 prefManager.setCharPref("general.useragent.vendorSub", general_useragent_vendorSub);
			}
			
		} catch(e) {
	
			LogManager.logToConsole("revertUserAgent caught an exception: " + e.name + ": " + e.message);
		}
	},
	
	revertProxy: function() {

		try {
			var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);

			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.ftp") ) {
				var network_proxy_backup_ftp = prefManager.getCharPref("extensions.fireshark.archived.network.proxy.backup.ftp");
				prefManager.setCharPref("network.proxy.backup.ftp", network_proxy_backup_ftp);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.ftp_port") ) {
				var network_proxy_backup_ftp_port = prefManager.getIntPref("extensions.fireshark.archived.network.proxy.backup.ftp_port");
				prefManager.setIntPref("network.proxy.backup.ftp_port", network_proxy_backup_ftp_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.gopher") ) {
				var network_proxy_backup_gopher = prefManager.getCharPref("extensions.fireshark.archived.network.proxy.backup.gopher");
				prefManager.setCharPref("network.proxy.backup.gopher", network_proxy_backup_gopher);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.gopher_port") ) {
				var network_proxy_backup_gopher_port = prefManager.getIntPref("extensions.fireshark.archived.network.proxy.backup.gopher_port");
				prefManager.setIntPref("network.proxy.backup.gopher_port", network_proxy_backup_gopher_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.socks") ) {
				var network_proxy_backup_socks = prefManager.getCharPref("extensions.fireshark.archived.network.proxy.backup.socks");
				prefManager.setCharPref("network.proxy.backup.socks", network_proxy_backup_socks);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.socks_port") ) {
				var network_proxy_backup_socks_port = prefManager.getIntPref("extensions.fireshark.archived.network.proxy.backup.socks_port");
				prefManager.setIntPref("network.proxy.backup.socks_port", network_proxy_backup_socks_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.ssl") ) {
				var network_proxy_backup_ssl = prefManager.getCharPref("extensions.fireshark.archived.network.proxy.backup.ssl");
				prefManager.setCharPref("network.proxy.backup.ssl", network_proxy_backup_ssl);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.backup.ssl_port") ) {
				var network_proxy_backup_ssl_port 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.backup.ssl_port");
				prefManager.setIntPref("network.proxy.backup.ssl_port", network_proxy_backup_ssl_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.ftp") ) {
				var network_proxy_ftp 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.ftp");
				prefManager.setIntPref("network.proxy.ftp", network_proxy_ftp);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.ftp_port") ) {
				var network_proxy_ftp_port 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.ftp_port");
				prefManager.setIntPref("network.proxy.ftp_port", network_proxy_ftp_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.gopher") ) {
				var network_proxy_gopher 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.gopher");
				prefManager.setIntPref("network.proxy.gopher", network_proxy_gopher);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.gopher_port") ) {
				var network_proxy_gopher_port 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.gopher_port");
				prefManager.setIntPref("network.proxy.gopher_port", network_proxy_gopher_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.socks") ) {
				var network_proxy_socks 	= prefManager.getCharPref("extensions.fireshark.archived.network.proxy.socks");
				prefManager.setCharPref("network.proxy.socks", network_proxy_socks);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.socks_port") ) {
				var network_proxy_socks_port 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.socks_port");
				prefManager.setIntPref("network.proxy.socks_port", network_proxy_socks_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.ssl") ) {
				var network_proxy_ssl 	= prefManager.getCharPref("extensions.fireshark.archived.network.proxy.ssl");
				prefManager.setCharPref("network.proxy.ssl", network_proxy_ssl);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.ssl_port") ) {
				var network_proxy_ssl_port 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.ssl_port");
				prefManager.setIntPref("network.proxy.ssl_port", network_proxy_ssl_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.http") ) {
				var network_proxy_http 	= prefManager.getCharPref("extensions.fireshark.archived.network.proxy.http");
				prefManager.setCharPref("network.proxy.http", network_proxy_http);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.http_port") ) {
				var network_proxy_http_port 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.http_port");
				prefManager.setIntPref("network.proxy.http_port", network_proxy_http_port);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.share_proxy_settings") ) {
				var network_proxy_share_proxy_settings 	= prefManager.getBoolPref("extensions.fireshark.archived.network.proxy.share_proxy_settings");
				prefManager.setBoolPref("network.share_proxy_settings", network_proxy_share_proxy_settings);
			}
			
			if( prefManager.prefHasUserValue("extensions.fireshark.archived.network.proxy.type") ) {
				var network_proxy_type 	= prefManager.getIntPref("extensions.fireshark.archived.network.proxy.type");
				prefManager.setIntPref("network.proxy.type", network_proxy_type);
			}
			
		} catch(e) {
	
			LogManager.logToConsole("revertProxy caught an exception: " + e.name + ": " + e.message);
		}
	},
	
	getNumCallbacks: function() {

		try {
			var n = 0;
			for (var c in this.callbacks) { n++; }
			//LogManager.logToConsole("Fireshark:getNumCallbacks() callback count = " + n);
			return n;

		} catch(e) {
	
			LogManager.logToConsole("getNumCallbacks caught an exception: " + e.name + ": " + e.message);
			return 0;
		}
	},

	clear: function () {

		try {
			//LogManager.logToConsole("Fireshark:clear() called");

			if(this.running == true) {

				this.stop();
			}

			this.running = false;

			this.params = {};
			
			while (this.urls.length > 0) { this.urls.shift(); }

			while (this.eventArray.length > 0) { this.eventArray.shift(); }

			this.currenturl = '';
			
			this.requestStateCount = 0;
			this.responseStateCount = 0;


			var c = this.getNumCallbacks();
			//LogManager.logToConsole("Fireshark:clear() number of callbacks = " + c);

			var e = this.eventArray.length;
			//LogManager.logToConsole("Fireshark:clear() number of events = " + e);


		} catch(e) {

			LogManager.logToConsole("clear caught an exception: " + e.name + ": " + e.message);
		}
	},

	shutdown: function () {

		try {
			LogManager.logToConsole("Fireshark:shutdown() called");

			// clear state
			this.clear();
			
			// revert user-agent
			this.revertUserAgent();
			
			// revert proxy
			this.revertProxy();

			// register event callback
			//LogManager.logToConsole("Fireshark:shutdown() unregistering callback");
			this.unregisterCallback(this.firesharkEventCallback);

			// delete callbacks when fireshark exits
			for (var c in this.callbacks) { delete this.callbacks[c]; }

		} catch(e) {

			LogManager.logToConsole("shutdown caught an exception: " + e.name + ": " + e.message);
		}
	},

	start: function (jsonStr) {

		try {

			//LogManager.logToConsole("Fireshark:start() called running:" + this.running);

			this.clear(); // clear state
			
			var ret = true;
			
			// TODO: close all tabs but one, and make it about:blank

			// get main browser window (if operating in the scope of a dialog)
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   		.getService(Components.interfaces.nsIWindowMediator);

			var mainWindow = wm.getMostRecentWindow("navigator:browser");
			this.mainWindow = mainWindow;

			// TODO: if start is called from a scope other than the dialog than we'll have to get the window another way.

			// for debug
			LogManager.logToConsole("Fireshark received params:\n" + jsonStr);

			try {
			
				var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
				this.params = nativeJSON.decode(jsonStr);
				
			} catch(e) {

				LogManager.logToConsole("Fireshark.start caught an exception decoding params: " + e.name + ": " + e.message);
				return false;
			}
				
			LogManager.logToConsole("Fireshark normalizing params");
			ret = this.verifyInputParams();
			if(!ret) {
				//LogManager.logToConsole("Fireshark:start() verifyInputParams returned false, returning...\n");
				return ret;
			}
			
			var jsonStr = nativeJSON.encode(this.params);
			LogManager.logToConsole("Fireshark normalized params:\n" + jsonStr);
			
			// store urls for processing
			LogManager.logToConsole("Fireshark storing urls for processing");
			if(this.params.urls.length != 0) {

			    for (var i = 0; i < this.params.urls.length; i++) {	
					var url = this.params.urls[i];
					LogManager.logToConsole("storing url: " + url);
					this.urls.push(url);
			    }

			} else if(this.params.urlFile.length != 0) {

				LogManager.logToConsole("Fireshark using URL file");
				this.fileLinesToArray(this.params.urlFile, this.urls);
				// TODO: check if this was successful and return approprietly
			}

			// start netmonitor for http events
			LogManager.logToConsole("Fireshark starting http monitoring");
			httpRequestObserver.start();

			// start dom content load monitoring
			LogManager.logToConsole("Fireshark starting dom content load monitoring");
			// https://bugzilla.mozilla.org/show_bug.cgi?id=608628
        	//this.mainWindow.gBrowser.addProgressListener(myListener, Components.interfaces.nsIWebProgress.NOTIFY_STATE_ALL);
			this.mainWindow.gBrowser.addProgressListener(myListener);

			// start jsmonitor to monitor js events
			// too slow, works, but causes script warning messages in browser, thus commenting out
			// ...or maybe not, after altering saving a file by sha1 and making it a random number + unique, this might be fast enough
			// ...but no
			//JSMonitor.start();

			this.running = true;

			LogManager.logToConsole("Fireshark running:" + this.running);

			LogManager.logToConsole("Fireshark # of URLs: " + this.urls.length);


			var event = {};
			event.eventType 	= "loadurlsstart";
			event.urlCount 		= this.urls.length;
			
			//LogManager.logToConsole("Fireshark::start() triggering callback");
			this.triggerCallback(event);

			// start loading urls!
			this.loadNextURL();

		} catch(e) {

			LogManager.logToConsole("start caught an exception: " + e.name + ": " + e.message);
			return false;
		}
		
		return ret;
	},

	stop: function () {

		try {
			if(this.running == true) {

				httpRequestObserver.stop();
				
				//JSMonitor.stop();

				this.mainWindow.gBrowser.removeProgressListener(myListener);

				this.running = false;	
			}

		} catch(e) {

			LogManager.logToConsole(e);
		}

	},

	firesharkEventCallback: function (event) {

		try {
			// import singleton objects
			Components.utils.import("resource://content/logmanager.js");
			Components.utils.import("resource://content/fireshark.js");

			//LogManager.logToConsole("firesharkEventCallback called eventType = " + event.eventType);

			Fireshark.eventArray.push(event);

			//LogManager.logToConsole("firesharkEventCallback Fireshark.eventArray has " + Fireshark.eventArray.length + " items");

		} catch(e) {

			LogManager.logToConsole("firesharkEventCallback caught an exception: " + e.name + ": " + e.message);
		}

	},

	registerCallback: function(callbackFunction) {

		try {

			// import singleton objects
			Components.utils.import("resource://content/logmanager.js");
			Components.utils.import("resource://content/fireshark.js");

			this.callbacks[callbackFunction] = callbackFunction;

			//LogManager.logToConsole("registerCallback called");

			var c = this.getNumCallbacks();

			//LogManager.logToConsole("registerCallback there are now " + c + " callbacks");

		} catch(e) {

			LogManager.logToConsole("registerCallback caught an exception: " + e.name + ": " + e.message);
		}
	},

	unregisterCallback: function(callbackFunction) {

		try {
			delete this.callbacks[callbackFunction];

			//LogManager.logToConsole("unregisterCallback called");

			var c = this.getNumCallbacks();

			//LogManager.logToConsole("unregisterCallback there are now " + c + " callbacks");

		} catch(e) {

			LogManager.logToConsole("unregisterCallback caught an exception: " + e.name + ": " + e.message);
		}
	},

	triggerCallback: function(event) {

		try {

			// import singleton objects
			Components.utils.import("resource://content/logmanager.js");
			Components.utils.import("resource://content/fireshark.js");

			//LogManager.logToConsole("triggerCallback called eventType = " + event.eventType);

			var c = this.getNumCallbacks();

			//LogManager.logToConsole("triggerCallback there are " + c + " callbacks");

			var count = 0;
			for (var c in this.callbacks) {

				this.callbacks[c](event);
				count++;
			}

			//LogManager.logToConsole("triggerCallback issued " + count + " callbacks");

		} catch(e) {

			LogManager.logToConsole("triggerCallback caught an exception: " + e.name + ": " + e.message);
		}
	},

	fileLinesToArray: function (filepath, arr) {

		try {
			// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
			var file = Components.classes['@mozilla.org/file/local;1']
				.createInstance(Components.interfaces.nsILocalFile);

			file.initWithPath(filepath);

			// open an input stream from file
        		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
        			.createInstance(Components.interfaces.nsIFileInputStream);

        		istream.init(file, 0x01, 0444, 0);
        		istream.QueryInterface(Components.interfaces.nsILineInputStream);

			// read lines into array
			var line = {}, hasmore;

			do {

			    	hasmore = istream.readLine(line);
			    	arr.push(line.value);

				//LogManager.logToConsole(line.value);

			} while (hasmore);

			//LogManager.logToConsole("Fireshark:fileLinesToArray() # of URLs: " + arr.length);

			istream.close();

		} catch(e) {

			LogManager.logToConsole(e);
		}
	},


	loadNextURL: function () {

		try {

			//LogManager.logToConsole("processing next URL");

			if(this.running == true) {

				LogManager.logToConsole("\n");
				
				LogManager.logToConsole(this.urls.length + " URLs left to process");

				var timeout = this.params.urlLoadTimeout;
				
				LogManager.logToConsole("timeout: " + timeout);
				
				this.requestStateCount = 0;
				this.responseStateCount = 0;

				if (this.urls.length > 0) {

					var url = this.urls.shift();
					this.currenturl = url;
					
					LogManager.logToConsole("processing URL: " + this.currenturl);

					this.instanceStartTime = new Date();
        			this.instanceStartTime.getTime();

					var event = {};
					event.eventType 	= "loadurl";
					event.url 			= this.currenturl;
					event.startTime		= this.instanceStartTime;

					//LogManager.logToConsole("Fireshark::loadNextURL() triggering callback");
					this.triggerCallback(event);
		
					// https://developer.mozilla.org/en/Code_snippets/Tabbed_browser
					// https://developer.mozilla.org/en/DOM/window.setTimeout
					// Failsafe, just in case the load takes too long
					LogManager.logToConsole("setting timeout"); 
					this.timeoutID = this.mainWindow.setTimeout(function() {
					    
					try {
					
						LogManager.logToConsole("DOM content load timeout reached on URL: " + Fireshark.currenturl);
						
						Fireshark.instanceEndTime = new Date();
						Fireshark.instanceEndTime.getTime();
						
						// new code - try to get content even though content load event didn't trigger and we
						// hit timeout
						try {
						
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
							
							var enumerator = wm.getEnumerator("navigator:browser");  
							while(enumerator.hasMoreElements()) {  
								var win = enumerator.getNext();  
								LogManager.logToConsole("found window");
								// win is [Object ChromeWindow] (just like window), do something with it  
							}  

							var mainWindow = wm.getMostRecentWindow("navigator:browser");
			
							LogManager.logToConsole("saving screenshot to disk");
							
							var ssinfo = SaveScreenShot(Fireshark.params.saveLocation, mainWindow);
							
							// save dom and src information (each dom is associated with original cached source)
							LogManager.logToConsole("saving all doms and original source code to disk");
							var doms = new Array();
							SaveAllDOMs(doms, Fireshark.params.saveLocation, mainWindow); 

							var event = {};
							event.eventType 	= "contentattimeout";
							event.url 			= url;
							event.href			= mainWindow.location.href;
							event.ssfile		= ssinfo.filepath;
							event.ssfilesize	= ssinfo.filesize;
							event.doms			= doms;
							event.startTime		= Fireshark.instanceStartTime;
							event.endTime		= Fireshark.instanceEndTime;
							event.diffTime		= diff;

							//LogManager.logToConsole("onStateChange triggering callback");
							Fireshark.triggerCallback(event);
						}
						catch(e) {
							LogManager.logToConsole("Exception caught in setTimeout trying to save content: " + e.name + ": " + e.message);
						}
						
						// end of new code addition

						var diff = Fireshark.instanceEndTime - Fireshark.instanceStartTime;
						//LogManager.logToConsole("start " + Fireshark.instanceStartTime);
						//LogManager.logToConsole("end " + Fireshark.instanceEndTime);
						LogManager.logToConsole("content timed out after " + diff + " ms of load time");
						 
						var event = {};
						event.eventType 	= "loadurltimeout";
						event.url 			= Fireshark.currenturl;
						event.startTime		= Fireshark.instanceStartTime;
						event.endTime		= Fireshark.instanceEndTime;
						event.diffTime		= diff;
						
						/*if(Fireshark.mainWindow != null) {
						
							LogManager.logToConsole("saving screenshot to disk");
							var ssinfo = SaveScreenShot(Fireshark.params.saveLocation, Fireshark.mainWindow);
					
							// save dom and src information (each dom is associated with original cached source)
							LogManager.logToConsole("saving all doms and original source code to disk");
							var doms = new Array();
							SaveAllDOMs(doms, Fireshark.params.saveLocation, Fireshark.mainWindow);
							
							event.ssfile		= ssinfo.filepath;
							event.ssfilesize	= ssinfo.filesize;
							event.doms			= doms;
						}*/

						//LogManager.logToConsole("Fireshark::loadNextURL() triggering callback");
					
						Fireshark.triggerCallback(event);

						Fireshark.loadNextURL(); // go to next URL
					}
					catch(e) {
					
						LogManager.logToConsole("Exception caught in setTimeout: " + e.name + ": " + e.message);
						Fireshark.mainWindow.clearTimeout(Fireshark.timeoutID);
						Fireshark.loadNextURL();
					}
					
							}, timeout);

					this.currenturl = url;
					
					//https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIWebNavigation
					var loadFlags = Components.interfaces.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
					
					LogManager.logToConsole("loadFlags: " + loadFlags);
									
					var referrer;
					if(this.params.httpReferrer != undefined && this.params.httpReferrer.length > 0) {
						referrer = makeURI(this.params.httpReferrer, null, null);
					}
					
					this.mainWindow.gBrowser.loadURI(url, null, referrer, null, null);

				} else {

					LogManager.logToConsole("\n");
					
					var event = {};
					event.eventType 	= "loadurlsend";
					event.urlCount 		= this.urls.length;

					//LogManager.logToConsole("Fireshark::loadNextURL() triggering callback");

					this.triggerCallback(event);

					this.running = false; // let's just assume we can open up for new request now...
				}
			}

		} catch(e) {

			LogManager.logToConsole(e);
		}

	}

};
