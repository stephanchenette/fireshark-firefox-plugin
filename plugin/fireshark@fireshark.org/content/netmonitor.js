
var EXPORTED_SYMBOLS = ['httpRequestObserver'];

Components.utils.import("resource://content/logmanager.js");
Components.utils.import("resource://content/fireshark.js");
Components.utils.import("resource://content/utils.js");

// references:
// https://developer.mozilla.org/en/Setting_HTTP_request_headers#Observers
// https://developer.mozilla.org/en/nsIHttpChannel
// http://forums.mozillazine.org/viewtopic.php?f=19&t=427601
// http://forums.mozillazine.org/viewtopic.php?f=19&t=573191&start=0&st=0&sk=t&sd=a
// http://forums.mozillazine.org/viewtopic.php?f=19&t=528047
var httpRequestObserver =
{
    QueryInterface: function (aIID)
    {
        if (aIID.equals(Components.interfaces.nsISupports) ||
            aIID.equals(Components.interfaces.nsIObserver)) {
            return this;
	}

        throw Components.results.NS_NOINTERFACE;

    },

    start: function ()
    {
	var observerService = Components.classes["@mozilla.org/observer-service;1"]
		.getService(Components.interfaces.nsIObserverService);

	//observerService.addObserver(this, "quit-application", false);
        observerService.addObserver(this, "http-on-modify-request", false);
        observerService.addObserver(this, "http-on-examine-response", false);

	var event = {};
	event.eventType 	= "httpStart";

	Components.utils.import("resource://content/fireshark.js");

	Fireshark.triggerCallback(event);

    },

    stop: function ()
    {
	var observerService = Components.classes["@mozilla.org/observer-service;1"]
		.getService(Components.interfaces.nsIObserverService);

	//observerService.removeObserver(this, "quit-application");
     	observerService.removeObserver(this, "http-on-modify-request");
     	observerService.removeObserver(this, "http-on-examine-response");
    },

	getChannelWindow: function (/**nsIChannel*/ channel) /**nsIDOMWindow*/
	{
	var callbacks = [];
	if (channel.notificationCallbacks)
		callbacks.push(channel.notificationCallbacks);
	if (channel.loadGroup && channel.loadGroup.notificationCallbacks)
		callbacks.push(channel.loadGroup.notificationCallbacks);

	for each (var callback in callbacks)
	{
		try {
			// For Gecko 1.9.1
			return callback.getInterface(Components.interfaces.nsILoadContext).associatedWindow;
		} catch(e) {}

		try {
			// For Gecko 1.9.0
			return callback.getInterface(Components.interfaces.nsIDOMWindow);
		} catch(e) {}
	}

	return null;
	},


    //	https://developer.mozilla.org/en/Creating_Sandboxed_HTTP_Connections
    //	aSubject: the channel (nsIChannel) that caused this notification to happen.
    //	aTopic: the notification topic.
    //		http-on-modify-request
    //		http-on-examine-response
    //	aData: null for the two topics. 
    observe: function (subject, topic, data)
    {
		try
		{
			Components.utils.import("resource://content/logmanager.js");
			Components.utils.import("resource://content/fireshark.js");

			LogManager.logToConsole("---------- observe called");

			if(!(subject instanceof Components.interfaces.nsIHttpChannel)) {
				LogManager.logToConsole("subject not instance of nsIHttpChannel\n");
				return;
			}

			var win = this.getChannelWindow(subject);
			
			// Some requests are not associated with any page (e.g. favicon).
			// These should be ignored.
			if(win == null) {
				//LogManager.logToConsole("request not associated with a window\n");
				//LogManager.logToConsole("---------- leaving observe\n"); 
				return;
			}

			if (topic == "http-on-modify-request") {

				//LogManager.logToConsole("-------------------- observe called - http-on-modify-request");

				try {
					var isFrame = false;
					
					// find out what page is being requested.
					var name = subject.URI.asciiSpec;
					var origName = subject.originalURI.asciiSpec;
					var isRedirect = (name != origName);
					
					// e.g. favicon.ico or chrome://browser/content/browser.xul
					if(win.document.URL == undefined) {
						//LogManager.logToConsole("win.document.url " + win.document.URL);
						//LogManager.logToConsole("win.location.href " + win.location.href);
						//LogManager.logToConsole("request not associated with a URL\n");
						//LogManager.logToConsole("-------------------- leaving observe called - http-on-modify-request\n"); 
						return;
					}
					
					if ((subject.loadFlags & Components.interfaces.nsIChannel.LOAD_DOCUMENT_URI) &&
						subject.loadGroup && subject.loadGroup.groupObserver &&
						win == win.parent && !isRedirect)
					{
						//LogManager.logToConsole("request is a top document uri (not a frame)\n"); 
						isFrame = false;
					}
					else {
						//LogManager.logToConsole("request is a a frame\n");
						isFrame = true;
					}
		   						
					// The nsIChannel needs to be converted into a nsIHttpChannel by using QueryInterface (QI): 
					var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
						
					if(isRedirect) {
						
						var event = {};
						event.eventType 	= "connection";
						event.type 		= "request";
						event.src		= origName;
						event.dst		= name;
						event.redirect		= "true";
					} 
					else 
					{
						if(httpChannel.referrer)
						{
							var event = {};
							event.eventType 	= "connection";
							event.type 		= "request";
							event.src		= httpChannel.referrer.asciiSpec;
							event.dst		= name;
							event.redirect		= "false";
						}
						else 
						{
							var ref = undefined;
							
							if(httpChannel instanceof Components.interfaces.nsIHttpChannelInternal && httpChannel.documentURI)
							{
								ref = httpChannel.documentURI.asciiSpec;
								
								//LogManager.logToConsole("from documentURI ref URL " + ref);
							}
						    	else if(isFrame) 
							{
								// there are cases when URL for both doc url and win location href are about:blank if it's a frame,
								// in these cases we'll fetch the parent window and use that url. todo: keep looking at parent window until one is not about:blank
								// todo: verify that parentwin != win, (just want to see).
								var tmpwin = win;
								//LogManager.logToConsole("Looping to find parent (TODO: dont' need to always go to parent!!)");
								while(tmpwin != tmpwin.parent) 
								{
									
									//LogManager.logToConsole("frame document.URL " + tmpwin.document.URL);
									//LogManager.logToConsole("frame window.location.href " + tmpwin.location.href);
									
									tmpwin = tmpwin.parent;
								} 
								
								ref = tmpwin.document.URL;
								
								//LogManager.logToConsole("frame document.URL " + tmpwin.document.URL);
								//LogManager.logToConsole("frame window.location.href " + tmpwin.location.href);
								
								//LogManager.logToConsole("from iframe ref URL " + ref);
							}
							else
							{
								ref = win.document.URL;
								
								//LogManager.logToConsole("from else ref URL " + ref);
							}
							
							if(ref != undefined)
							{
								var event = {};
								event.eventType 	= "connection";
								event.type 		= "request";
								event.src		= ref;
								event.dst		= name;
								event.redirect		= "false";
							}
						}
					}
					
					// found in source of LiveHttpHeaders extension
					var httpVersion = "HTTP/1.x";

					if (httpChannel instanceof Components.interfaces.nsIHttpChannelInternal)
					{
						var major = {};
						var minor = {};

						httpChannel.getRequestVersion(major, minor);

						httpVersion = "HTTP/" + major.value + "." + minor.value;
					}
					
					var requestMethod = httpChannel.requestMethod;
					//LogManager.logToConsole("request method " + requestMethod);
					
					var headers = [];

					// https://developer.mozilla.org/en/nsIHttpChannel
					if(Fireshark.requestStateCount == 0 && Fireshark.params.httpReferrer != undefined && Fireshark.params.httpReferrer.length > 0) {
						httpChannel.setRequestHeader("Referer", Fireshark.params.httpReferrer, true);
					}
					
					httpChannel.visitRequestHeaders({

						visitHeader: function (name, value)
						{
							headers.push({ name: name, value: value });
						}
					});
					
					var headerRequestStatus =  requestMethod + " " + name + " " + httpVersion;
					
					// event response status line
					event.statusLine = headerRequestStatus;
				
					if(headers.length > 0) {

						// event headers
						event.headers = new Array();
						event.headers = headers;
					}
					
					// save the request data (postdata if it exists)
					// https://developer.mozilla.org/en/Code_snippets/Miscellaneous
					subject.QueryInterface(Components.interfaces.nsIUploadChannel);
					var postData = subject.uploadStream; // postData is not a string, but an nsIInputStream
					if(postData != null) {
					
						// save stream to disk if not zero
						var stream = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
						stream.setInputStream(postData);
						var postBytes = stream.readByteArray(stream.available());
						var poststr = String.fromCharCode.apply(null, postBytes);
						
						LogManager.logToConsole("postData = " + poststr); 
						
						// rewind
						postData.QueryInterface(Components.interfaces.nsISeekableStream)
							.seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, 0);
					}
					
					// update number of requests
					Fireshark.requestStateCount++;

					LogManager.logToConsole("request src = " + event.src + " dst = " + event.dst); 
					Fireshark.triggerCallback(event);

					//LogManager.logToConsole("-------------------- leaving observe called - http-on-modify-request\n"); 
					
				} catch(e) {

					LogManager.logToConsole("http-on-modify-request caught exception: " + e + "\n"); 
				}
			}
			else if (topic == "http-on-examine-response") 
			{

				//LogManager.logToConsole("-------------------- observe called - http-on-examine-response");
				
				try {
					
					var isFrame = false;
					var name = subject.URI.asciiSpec;
					var origName = subject.originalURI.asciiSpec;
					var isRedirect = (name != origName);
					
					var event = {};

					// e.g. favicon.ico or chrome://browser/content/browser.xul
					if(win.document.URL == undefined) {
						//LogManager.logToConsole("win.document.url " + win.document.URL);
						//LogManager.logToConsole("win.location.href " + win.location.href);
						//LogManager.logToConsole("request not associated with a URL\n");
						//LogManager.logToConsole("-------------------- leaving observe called - http-on-examine-response"); 
						return;
					}
					
					if ((subject.loadFlags & Components.interfaces.nsIChannel.LOAD_DOCUMENT_URI) &&
						subject.loadGroup && subject.loadGroup.groupObserver &&
						win == win.parent && !isRedirect)
					{
						//LogManager.logToConsole("response is a top document uri (not a frame)\n");  
						isFrame = false;
					}
					else {
						//LogManager.logToConsole("response is a a frame\n");  
						isFrame = true;
					}
					
					// The nsIChannel needs to be converted into a nsIHttpChannel by using QueryInterface (QI): 
					var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);

					// Example Server Response
					// HTTP/1.1 200 OK
					// Date: Mon, 23 May 2005 22:38:34 GMT
					// Server: Apache/1.3.3.7 (Unix)  (Red-Hat/Linux)
					// Last-Modified: Wed, 08 Jan 2003 23:11:55 GMT
					// Etag: "3f80f-1b6-3e1cb03b"
					// Accept-Ranges: bytes
					// Content-Length: 438
					// Connection: close
					// Content-Type: text/html; charset=UTF-8


					// https://developer.mozilla.org/en/nsIChannel
					// https://developer.mozilla.org/en/nsIHttpChannel
					// http://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol
					// https://developer.mozilla.org/en/nsIURI
					// https://developer.mozilla.org/en/NsIHttpChannel#getRequestHeader.28.29

					var responseStatus = httpChannel.responseStatus; // e.g. 200 || 302, etc
					var responseStatusText = httpChannel.responseStatusText; // e.g. OK
					var contentType = httpChannel.contentType;
					var contentLength = httpChannel.contentLength;
					
					var server_uri = httpChannel.URI.asciiSpec; // this is the server URI
					var server_original_uri = httpChannel.originalURI.asciiSpec; // this is the server URI
					
					//LogManager.logToConsole("ClientURI " + client_uri + "\n");
					//LogManager.logToConsole("ServerURI " + server_uri + "\n");
					//LogManager.logToConsole("OriginalServerURI " + server_original_uri + "\n");

					if(httpChannel.referrer)
					{
						var ref = httpChannel.referrer.asciiSpec; 
						
						event.eventType 	= "connection";
						event.type 		= "response";
						event.src		= server_uri;
						event.originalSrc	= server_original_uri;
						event.dst		= ref;
						event.status		= responseStatus;

						//LogManager.logToConsole("from document.referrer ref URL " + ref);
					}
					else
					{
						var ref = undefined;
							
						if(httpChannel instanceof Components.interfaces.nsIHttpChannelInternal && httpChannel.documentURI)
						{
							ref = httpChannel.documentURI.asciiSpec;
							
							//LogManager.logToConsole("from documentURI ref URL " + ref);
						}
						else if(isFrame) 
						{
							// there are cases when URL for both doc url and win location href are about:blank if it's a frame,
							// in these cases we'll fetch the parent window and use that url. todo: keep looking at parent window until one is not about:blank
							// todo: verify that parentwin != win, (just want to see).
							var tmpwin = win;
							while(tmpwin != tmpwin.parent) 
							{
								//LogManager.logToConsole("frame document.URL " + tmpwin.document.URL);
								//LogManager.logToConsole("frame window.location.href " + tmpwin.location.href);
								
								tmpwin = tmpwin.parent;
							} 
							
							ref = tmpwin.document.URL;
							
							//LogManager.logToConsole("frame document.URL " + tmpwin.document.URL);
							//LogManager.logToConsole("frame window.location.href " + tmpwin.location.href);
							
							//LogManager.logToConsole("from iframe ref URL " + ref);
						}
						else
						{
							ref = win.document.URL;
							
							//LogManager.logToConsole("from else ref URL " + ref);
						}
							
						if(ref != undefined)
						{
							event.eventType 	= "connection";
							event.type 		= "response";
							event.src		= name;
							event.dst		= ref;
							event.status		= responseStatus;
						}
					}
					
					// found in source of LiveHttpHeaders extension
					var httpVersion = "HTTP/1.x";

					if (httpChannel instanceof Components.interfaces.nsIHttpChannelInternal)
					{
						var major = {};
						var minor = {};

						httpChannel.getResponseVersion(major, minor);

						httpVersion = "HTTP/" + major.value + "." + minor.value;
					}

					// http://www.mozilla.org/projects/embedding/embedapiref/embedapi65.html
					// fetching of headers was figured out by look at firebug code...
					// http://code.google.com/p/fbug/source/browse/branches/firebug1.4/content/firebug/spy.js?spec=svn1881&r=1881
					var headers = [];

					// fetch headers
					httpChannel.visitResponseHeaders({

						visitHeader: function (name, value)
						{
							headers.push({ name: name, value: value });
						}
					});
					
					var headerResponseStatus = httpVersion + " " + responseStatus + " " + responseStatusText;
					//LogManager.logToConsole(headerResponseStatus + "\n");

					// event response status line
					event.statusLine = headerResponseStatus;
				
					if(headers.length > 0) {

						// event headers
						event.headers = new Array();
						event.headers = headers;
					}
					
					// save all content that is sent back to the browser e.g. gifs, html, swfs, etc.
					LogManager.logToConsole("attempting to save response content to disk");
					var filepath = SaveSource(event.src, Fireshark.params.saveLocation, win);
					event.filepath = filepath;
					
					LogManager.logToConsole("logged file " + event.filepath);

					// update response count
					Fireshark.responseStateCount++;
					
					LogManager.logToConsole("response src = " + event.src + " dst = " + event.dst); 
					Fireshark.triggerCallback(event);
					
					//LogManager.logToConsole("-------------------- leaving observe called - http-on-examine-response"); 
					
				}
				catch(e)
				{
					LogManager.logToConsole("http-on-examine-response caught exception: " + e + "\n");
				}
			}

			else 
			{
				//LogManager.logToConsole("observed called - unknown topic");
			}
		}
		catch(e)
		{
			LogManager.logToConsole("observe caught exception: " + e + "\n"); 
		}
    }

};
