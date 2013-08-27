
var EXPORTED_SYMBOLS = ["DOMObserver"];

Components.utils.import("resource://content/logmanager.js");
Components.utils.import("resource://content/fireshark.js");
Components.utils.import("resource://content/utils.js");
 
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var gIOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
var gObserverService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

var gObserving = ["content-document-global-created"];

var DOMObserver = {

	observerOn: false,

	start: function () {

		try {
			LogManager.logToConsole("DOMObserver start called");
			
			if (!this.observerOn)
			{
				gObserving.forEach(function(aTopic) { gObserverService.addObserver(this, aTopic, false); }, this);
				this.observerOn = true;
			}
		} catch(e) {
			LogManager.logToConsole("DOMObserver::start caught an exception " + e.name + ": " + e.message);
		}
	},
	
	stop: function()
	{	
		try {
			LogManager.logToConsole("DOMObserver stop called");
			
			if(this.observerOn) {
				gObserving.forEach(function(aTopic) { gObserverService.removeObserver(this, aTopic); }, this);
				this.observerOn = false;
			}
		} catch(e) {
			LogManager.logToConsole("DOMObserver::stop caught an exception " + e.name + ": " + e.message);
		}
	},

	// https://developer.mozilla.org/en/Observer_Notifications
	observe: function(aSubject, aTopic, aData)
	{
		try {
			LogManager.logToConsole("DOMObserver observe called");
			switch (aTopic)
			{
			case "content-document-global-created":
				LogManager.logToConsole("DOMObserver observe called content-document-global-created");
				if(aSubject != aSubject.parent) {
					return;
				}
				
				LogManager.logToConsole("DOMObserver observe called content-document-global-created is parent");
				
				/*if(aSubject.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
				
					LogManager.logToConsole("DOMObserver observe called content-document-global-created is a navigator:browser");
				}*/
				
				// aSubject (nsIDOMWindow)
				LogManager.logToConsole("DOMObserver observe called content-document-global-created URL: " + aSubject.document.URL);
				if(aSubject.document.documentURIObject) {
					if(aSubject.document.documentURIObject.scheme) {
						var scheme = aSubject.document.documentURIObject.scheme;
						if(scheme == "about") {
							return;
						}
						LogManager.logToConsole("DOMObserver observe called content-document-global-created scheme: " + scheme);
					}
				}
				
				var doc = aSubject.document;
				if(doc != undefined) {
					//doc.addEventListener("DOMNodeRemovedFromDocument", watchDOMChanges, false);
					//doc.addEventListener("DOMNodeInsertedIntoDocument", watchDOMChanges, false);
					//doc.addEventListener("DOMContentLoaded", watchDOMChanges, false);	
					doc.addEventListener("DOMNodeInserted", watchDOMChanges, false);
					doc.addEventListener("DOMNodeRemoved", watchDOMChanges, false);
					//doc.addEventListener("DOMSubtreeModified", watchDOMChanges, false);
				}
				break;
			}
		} catch(e) {
			LogManager.logToConsole("DOMObserver::observe caught an exception " + e.name + ": " + e.message);
		}
	},
};

function watchDOMChanges(event) {

	try {
		LogManager.logToConsole("handleDOMManipulations called");
		if(event.type) {
			LogManager.logToConsole("\thandleDOMManipulations type: " + event.type);
			
			var node = event.target;
			
			if(node) {
				if(node.tagName) {
					// http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-eventgroupings-mutationevents
					
					LogManager.logToConsole("\ttagName: " + node.tagName.toLowerCase());
					
					var parentNode = node.parentNode;
					if(parentNode) {
					
						if(node.ownerDocument) {
							if(node.ownerDocument.URL) {
								LogManager.logToConsole("\turl: " + node.ownerDocument.URL);
							}
						}
					
						if(parentNode.innerHTML) {
							LogManager.logToConsole("\tnode: " + node.tagName);
							LogManager.logToConsole("\tparentNode: " + parentNode.tagName + " html length: " + parentNode.innerHTML.length);
							LogManager.logToConsole("\tparentNode: " + parentNode.tagName + " html: " + parentNode.innerHTML);
						}
					}
				}
			}
		}
	} catch(e) {
		LogManager.logToConsole("handleDOMManipulations caught an exception " + e.name + ": " + e.message);
	}
}