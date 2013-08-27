

// references:
// https://developer.mozilla.org/en/nsIWebProgressListener
// https://developer.mozilla.org/en/XPCOM_Interface_Reference/NsIWebProgressListener2  <=== for meta-refresh
// https://developer.mozilla.org/en/NsIWebProgress
// https://developer.mozilla.org/en/NsIRequest
// https://developer.mozilla.org/En/Mozilla_Embedding_FAQ/How_do_I...
// http://www.mail-archive.com/mozilla-xpcom@mozilla.org/msg05593.html

var EXPORTED_SYMBOLS = ['myListener'];

var myListener =
{
    QueryInterface: function (aIID)
    {
        if (aIID.equals(Components.interfaces.nsIWebProgressListener2) ||
            aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
            aIID.equals(Components.interfaces.nsISupports)) {
				return this;
		}

        throw Components.results.NS_NOINTERFACE;

    },

	// https://developer.mozilla.org/en/XPCOM_Interface_Reference/NsIWebProgressListener2
	onRefreshAttempted: function (/*nsIWebProgress*/ aWebProgress, /*nsIURI*/ aRefreshURI, /*long*/ aMillis, /*boolean*/ aSameURI)
    {
		Components.utils.import("resource://content/jsmonitor.js");
		Components.utils.import("resource://content/logmanager.js");
		Components.utils.import("resource://content/fireshark.js");
		Components.utils.import("resource://content/utils.js");
		
		var win = aWebProgress.DOMWindow;
		var doc = aWebProgress.DOMWindow.document;
		var url = aWebProgress.DOMWindow.document.URL;
		
		var event = {};
		event.eventType 	= "refresh";
		event.url 			= url;
		event.href			= win.location.href;
		event.refreshURI	= aRefreshURI.asciiSpec;
		event.delay			= aMillis;
		event.sameURI		= aSameURI;

		//LogManager.logToConsole("onStateChange triggering callback");
		Fireshark.triggerCallback(event);
		
		return true;
	},
	
	// http://stackoverflow.com/questions/1506788/how-to-filter-out-asynchronous-requests-in-progresslistener
	// https://developer.mozilla.org/en/nsIWebProgressListener
    onStateChange: function (/*sIWebProgressListener*/ aWebProgress, /*nsIRequest*/ aRequest, aFlag, aStatus)
    {
		Components.utils.import("resource://content/jsmonitor.js");
		Components.utils.import("resource://content/logmanager.js");
		Components.utils.import("resource://content/fireshark.js");
		Components.utils.import("resource://content/utils.js");

		//LogManager.logToConsole("---------- onStateChange called");

        // If you use myListener for more than one tab/window, use
        // aWebProgress.DOMWindow to obtain the tab/window which triggers the state change
		if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_TRANSFERRING){
		
			//LogManager.logToConsole("STATE_TRANSFERRING aRequest: " + aRequest + " aFlag: " + aFlag + " aStatus: " + aStatus + " url: " + url);
		}
		
		if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_REDIRECTING){
		
			//LogManager.logToConsole("STATE_REDIRECTING aRequest: " + aRequest + " aFlag: " + aFlag + " aStatus: " + aStatus + " url: " + url);
		}
		
		if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_START){
		
			//LogManager.logToConsole("STATE_START aRequest: " + aRequest + " aFlag: " + aFlag + " aStatus: " + aStatus + " url: " + url);
			if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_IS_DOCUMENT && aStatus == 0)
			{
				//LogManager.logToConsole("\tDOCUMENT STATE_START aRequest: " + aRequest + " aFlag: " + aFlag + " aStatus: " + aStatus + " url: " + url);
				
				try {
				
					var win = aWebProgress.DOMWindow;
					var doc = aWebProgress.DOMWindow.document;
					var url = aWebProgress.DOMWindow.document.URL;
							
					if(win == win.parent) 
					{
						LogManager.logToConsole("start and parent window\n");
						
					} 
					else 
					{
						//LogManager.logToConsole("this is a child window\n");
						//LogManager.logToConsole("---------- leaving onStateChange");	
						return;
					}

					
				} catch(e) {
					LogManager.logToConsole("onStateChange STATE_START caught an exception " + e.name + ": " + e.message);
				}
				
			}
		
		}

		if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_STOP)
		{
			if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_ALL){}
			if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_IS_REQUEST){}
			if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_IS_DOCUMENT){
			
					var win = aWebProgress.DOMWindow;
					var doc = aWebProgress.DOMWindow.document;
					var url = aWebProgress.DOMWindow.document.URL;
					
					LogManager.logToConsole("STATE_STOP STATE_IS_DOCUMENT aRequest: " + aRequest + " aFlag: " + aFlag + " aStatus: " + aStatus + " url: " + url);
			
			}
			if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_IS_NETWORK) {}
			if (aFlag & Components.interfaces.nsIWebProgressListener2.STATE_IS_WINDOW && aStatus == 0)
			{
	
				try {
					// https://developer.mozilla.org/En/DOM/Document.defaultView
					// document.defaultView is generally a reference to the window object for the document
					// document.defaultView returns a reference to the default AbstractView for the document
					// 
					// aWebProgress.DOMWindow.document.defaultView.document.URL can be 'about:blank'
					// if the above is true then
					// aWebProgress.DOMWindow.document.URL will also be 'about:blank'
					
					Fireshark.instanceEndTime = new Date();
					Fireshark.instanceEndTime.getTime();
					var diff = Fireshark.instanceEndTime - Fireshark.instanceStartTime;
						
					var win = aWebProgress.DOMWindow;
					var doc = aWebProgress.DOMWindow.document;
					var url = aWebProgress.DOMWindow.document.URL;
					
					if(win == win.parent) 
					{
						//LogManager.logToConsole("this is a parent window\n");
					} 
					else 
					{
						//LogManager.logToConsole("this is a child window\n");
						//LogManager.logToConsole("---------- leaving onStateChange");	
						return;
					}

					if(url != undefined)
					{
						//LogManager.logToConsole("url is present\n");
						//LogManager.logToConsole("URL: " + url + "\n");
					}
					else
					{
						//LogManager.logToConsole("url\n");
						//LogManager.logToConsole("URL: " + url + "\n");
					}
	
					LogManager.logToConsole("STATE_STOP aRequest: " + aRequest + " aFlag: " + aFlag + " aStatus: " + aStatus + " url: " + url);
			
					// http://www.w3schools.com/htmldom/dom_obj_document.asp
					// https://developer.mozilla.org/en/DOM/document
					
					LogManager.logToConsole("clearing timeout");
					Fireshark.mainWindow.clearTimeout(Fireshark.timeoutID);
					
					Fireshark.contentWindow = win;
					
					// let's give the screen shot and dom saving a bit of time to load
					LogManager.logToConsole("setting timeout"); 
					Fireshark.contentLoadedTimeoutID = Fireshark.contentWindow.setTimeout(function() {
						
						try {
						
							Fireshark.contentWindow.clearTimeout(Fireshark.contentLoadedTimeoutID);
							
							Fireshark.instanceEndTime = new Date();
							Fireshark.instanceEndTime.getTime();
							var diff = Fireshark.instanceEndTime - Fireshark.instanceStartTime;
					
							LogManager.logToConsole("saving screenshot to disk");
							var ssinfo = SaveScreenShot(Fireshark.params.saveLocation, Fireshark.contentWindow);
							
							// save dom and src information (each dom is associated with original cached source)
							LogManager.logToConsole("saving all doms and original source code to disk");
							var doms = new Array();
							SaveAllDOMs(doms, Fireshark.params.saveLocation, Fireshark.contentWindow); 

							var event = {};
							event.eventType 	= "contentloaded";
							event.url 			= url;
							event.href			= Fireshark.contentWindow.location.href;
							event.ssfile		= ssinfo.filepath;
							event.ssfilesize	= ssinfo.filesize;
							event.doms			= doms;
							event.startTime		= Fireshark.instanceStartTime;
							event.endTime		= Fireshark.instanceEndTime;
							event.diffTime		= diff;

							//LogManager.logToConsole("onStateChange triggering callback");
							Fireshark.triggerCallback(event);

							LogManager.logToConsole("load event completed, load took " + diff + "ms");
							
							LogManager.logToConsole("processing next url...");
								
							Fireshark.loadNextURL();	
							
						}
						catch(e) {
							Fireshark.contentWindow.clearTimeout(Fireshark.contentLoadedTimeoutID);
							LogManager.logToConsole("Exception caught in setTimeout for contentloaded event: " + e.name + ": " + e.message);
						}
					
					}, 3);
					
					
					/*
					LogManager.logToConsole("saving screenshot to disk");
					var ssinfo = SaveScreenShot(Fireshark.params.saveLocation, win);
					
					// save dom and src information (each dom is associated with original cached source)
					LogManager.logToConsole("saving all doms and original source code to disk");
					var doms = new Array();
					SaveAllDOMs(doms, Fireshark.params.saveLocation, win); 

					var event = {};
					event.eventType 	= "contentloaded";
					event.url 			= url;
					event.href			= win.location.href;
					event.ssfile		= ssinfo.filepath;
					event.ssfilesize	= ssinfo.filesize;
					event.doms			= doms;
					event.startTime		= Fireshark.instanceStartTime;
					event.endTime		= Fireshark.instanceEndTime;
					event.diffTime		= diff;

					//LogManager.logToConsole("onStateChange triggering callback");
					Fireshark.triggerCallback(event);

					LogManager.logToConsole("load event completed, load took " + diff + "ms");

					LogManager.logToConsole("processing next url...");
						
					Fireshark.loadNextURL();	
					*/
				} 
				catch(e) {

					LogManager.logToConsole("onStateChange caught an exception " + e);
					LogManager.logToConsole("clearing timeout...");
					Fireshark.mainWindow.clearTimeout(Fireshark.timeoutID);
					
					LogManager.logToConsole("processing next url...");
					Fireshark.loadNextURL();	
				}	        
			} else {
					
			}
		}
			
			//LogManager.logToConsole("---------- leaving onStateChange");
		
    },

	//
	//void onLocationChange(in nsIWebProgress aWebProgress,
    //                  in nsIRequest aRequest,
    //                  in nsIURI aLocation);
   //
    onLocationChange: function (aWebProgress, aRequest, aLocation)
    {

        // This fires when the location bar changes; i.e load event is confirmed
        // or when the user switches tabs. If you use myListener for more than one tab/window,
        // use aWebProgress.DOMWindow to obtain the tab/window which triggered the change.
		
		try
		{
			Components.utils.import("resource://content/logmanager.js");
			Components.utils.import("resource://content/fireshark.js");
			Components.utils.import("resource://content/utils.js");

			LogManager.logToConsole("location has changed");
			
			var win = aWebProgress.DOMWindow;
			var doc = aWebProgress.DOMWindow.document;
			var url = aWebProgress.DOMWindow.document.URL;
			
			if(win != win.parent) 
			{
				//LogManager.logToConsole("this is a child window\n");
				//LogManager.logToConsole("---------- leaving onLocationChange");
				return;
			}	
			
			// http://en.wikipedia.org/wiki/WYCIWYG
			// scheme can be wyciwyg://
			// in these cases skip and don't log
			if(aLocation.scheme == "wyciwyg")
			{
				//LogManager.logToConsole("scheme " + aLocation.scheme + " returning...\n");
				return;
			}
			else 
			{
				//LogManager.logToConsole("scheme " + aLocation.scheme + "\n");
			}
			
			if(url == aLocation.asciiSpec)
			{
				//LogManager.logToConsole("src and dst same returning...\n");
				return;
			}

			//JSMonitor.addEventListener(win);

			var event = {};
			event.eventType 	= "locationChanged";

			if( aRequest == null ) {
			
				//LogManager.logToConsole("a Request is null\n");

			} else {

				event.requestOriginalURL 	= aRequest.originalURI.asciiSpec;
				event.requestURL 		= aRequest.URI.asciiSpec;
			}
	
			event.url 	= url;
			event.dst 	= aLocation.asciiSpec;

			LogManager.logToConsole("location changed src=" + event.src + " dst=" + event.dst);
			Fireshark.triggerCallback(event);
		}
		catch(e) {
		
			LogManager.logToConsole("onLocationChange caught an exception " + e);
		}
		
		//LogManager.logToConsole("---------- leaving onLocationChange");
    },

    // For definitions of the remaining functions see XULPlanet.com
	onProgressChange64: function (/*nsIWebProgress*/aWebProgress, /*nsIRequest*/aRequest, 
								  /*long long*/curSelf, /*long long*/maxSelf, /*long long*/curTot, /*long long*/maxTot) {},
    onProgressChange: function (aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) {
	
		try {
		
			Components.utils.import("resource://content/logmanager.js");
			Components.utils.import("resource://content/fireshark.js");
			Components.utils.import("resource://content/utils.js");

			LogManager.logToConsole("progress has changed");
			
			var event = {};
			event.eventType 	= "progressChanged";
			
			if(aWebProgress != null) {
				var win = aWebProgress.DOMWindow;
				var doc = aWebProgress.DOMWindow.document;
				var url = aWebProgress.DOMWindow.document.URL;
				
				if(win == win.parent) 
				{
					//LogManager.logToConsole("this is a parent window\n");
				} 
				else 
				{
					//LogManager.logToConsole("this is a child window\n");
					//LogManager.logToConsole("---------- leaving onStateChange");	
					return;
				}
				
				event.url 		= 	url;
			}
			
			if( aRequest == null ) {
			
				//LogManager.logToConsole("a Request is null\n");

			} else {

				event.requestOriginalURL 	= aRequest.originalURI.asciiSpec;
				event.requestURL 			= aRequest.URI.asciiSpec;
			}
	
			event.curSelf 	= 	curSelf;
			event.maxSelf 	=	maxSelf; 
			event.curTot	=	curTot; 
			event.maxTot 	= 	maxTot;
			
			Fireshark.triggerCallback(event);
					
		} catch(e) {
			LogManager.logToConsole("onProgressChange caught an exception: " + e.name + ": " + e.message);
		}
	
	},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {}
};

