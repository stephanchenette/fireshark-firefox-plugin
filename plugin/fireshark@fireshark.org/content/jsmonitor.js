/* See license.txt for terms of usage */

var EXPORTED_SYMBOLS = ["JSMonitor"];
 
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const debuggerService = Cc["@mozilla.org/js/jsd/debugger-service;1"].getService(Ci.jsdIDebuggerService);
const ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
const threadManager = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager);
const prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
const JSONServ = Cc["@mozilla.org/dom/json;1"].getService(Ci.nsIJSON);

var debuggerOldFlags;
	
var JSMonitor = {

	debuggerWasOn: false,

	start: function () {

		Components.utils.import("resource://content/logmanager.js");
		Components.utils.import("resource://content/fireshark.js");
		Components.utils.import("resource://content/utils.js");
	
		//if(gBrowser) gBrowser.addEventListener("DOMContentLoaded", this.ContentLoaded, false);
		//if(gBrowser) gBrowser.addEventListener("DOMNodeInserted", this.ContentLoaded, false);
		
		// Initialize debugger
		debuggerWasOn = debuggerService.isOn;
		if (!debuggerWasOn)
		{
			debuggerService.clearFilters(); // clear the list of filters  
			
			if ("asyncOn" in debuggerService)
			{
				// Gecko 2.0 branch
				debuggerService.asyncOn({onDebuggerActivated: onDebuggerActivated});
			}
			else
			{
				// Gecko 1.9.x branch
				debuggerService.on();
				onDebuggerActivated();
			}
		}
		else
			onDebuggerActivated();
	},

	stop: function () { 
	
		debuggerService.scriptHook = null;
		debuggerService.functionHook = null;
		debuggerService.topLevelHook = null;
		debuggerService.interruptHook = null;
		debuggerService.flags = debuggerOldFlags;
		if (!debuggerWasOn) {
			debuggerService.clearFilters(); // clear the list of filters  
			debuggerService.off();
		}
	},
};

function onDebuggerActivated() { 
	debuggerService.scriptHook = scriptHook;
	debuggerService.functionHook = scriptHook;
	debuggerService.topLevelHook = scriptHook;

	debuggerOldFlags = debuggerService.flags;
	debuggerService.flags = ("DISABLE_OBJECT_TRACE" in Ci.jsdIDebuggerService ? Ci.jsdIDebuggerService.DISABLE_OBJECT_TRACE : 0);
}
	
var scriptHook = 
{
	onScriptCreated: function(script)
	{
		var event = {};
		event.eventType 	= "jsdebugger";
		
		processAction("compiled", script, event);
	},
	onScriptDestroyed: function(script)
	{
	},
	
	// frame = jsdIStackFrame
	// type = enum
	onCall: function(frame, type)
	{	
		//LogManager.logToConsole("onCall: frame: " + frame + " type: " + type + " functionName: " + frame.functionName);
		
		var event = {};
		event.eventType 	= "jsdebugger";
		event.functionName 	= frame.functionName;
		
		if (type == Ci.jsdICallHook.TYPE_TOPLEVEL_START || type == Ci.jsdICallHook.TYPE_FUNCTION_CALL) {
			processAction("executed", frame.script, event);
		}
		else if (type == Ci.jsdICallHook.TYPE_TOPLEVEL_END || type == Ci.jsdICallHook.TYPE_FUNCTION_RETURN) {
			processAction("returned", frame.script, event);
		}
	},
	prevScript: null,
	QueryInterface: XPCOMUtils.generateQI([Ci.jsdIScriptHook, Ci.jsdICallHook])
};

function processAction(action, script, event) {

	try {
		
		let fileURI = script.fileName;
		
		try
		{
			// Debugger service messes up file:/ URLs, try to fix them
			fileURI = ioService.newURI(fileURI, null, null).spec;
			
		} catch(e) {}
		
		// check filters.
		if (checkMatch(fileURI))
		{
				return;
		}

		// Get the script source now, it might be gone later :-(
		let source = null;
		if ((action == "compiled" || action == "executed"))
		{
			source = script.functionSource;
		}
		
		var href = fileURI;
		var lineNum = script.baseLineNumber;
		
		event.href			= href;
		event.action 		= action;
		event.lineNum		= lineNum;
		
		//
		// failed to use script.functionObject.jsFunctionName for functionName
		// caught an exception NS_ERROR_NOT_AVAILABLE: 
		// Component returned failure code: 0x80040111 (NS_ERROR_NOT_AVAILABLE) [jsdIScript.functionObject]
		// 
	
		//LogManager.logToConsole("JavaScript: action: " + action + " href: " + href + " lineNum: " + lineNum + " source: " + source);
		
		// this content is highly valuable, but saving on each javascript execution or return is not possible
		
		if(source) {
			if(source.length > 0) {
				event.sourceLength		= source.length;
				/*
				var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				var sha1Digest = getSha1DigestFromUTF8String(source);
				if(sha1Digest.length != 0) {
					LogManager.logToConsole("sha1Digest: " + sha1Digest);
					var sha1Dir = createSha1Directory(Fireshark.params.saveLocation, sha1Digest);
					LogManager.logToConsole("path: " + sha1Dir);
					if(sha1Dir.length != 0) {
						file.initWithPath(sha1Dir);
						file.append(sha1Digest);
						LogManager.logToConsole("sha1 path: " + file.path);
						saveFile(file.path, source);
						event.filepath		= file.path;
					}
				}
				*/
				/*
				var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				var randomString = getRandomString();
				if(randomString.length != 0) {
					var dir = createDirectory(path, randomString);
					if(dir.length != 0) {
						file.initWithPath(dir);
						file.append(randomString);
						file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
						saveFile(file.path, source);
						event.filepath		= file.path;
					}
				}
				*/
			}
		}
		
		Fireshark.triggerCallback(event);
		
	} catch(e) {
		LogManager.logToConsole("processAction caught an exception " + e.name + ": " + e.message);
	}
					
}
	
function checkMatch(fileURI)
{
	try {
		//LogManager.logToConsole("in checkMatch fileURI: " + fileURI);
		var  filters = new Array(/^chrome:\//, /^file:\//, /^resource:\//, /^XStringBundle/, /^x-jsd:ppbuffer/, /^XPCSafeJSObjectWrapper.cpp/); 
		
		for(i=0;i<filters.length;i++) 
		{
			//LogManager.logToConsole("checking: " + filters[i]);
			if (fileURI.match(filters[i])) {
				//LogManager.logToConsole("match FOUND");
				return true;
			}
		}
	}
	catch(e) {
		LogManager.logToConsole("checkMatch caught an exception " + e.name + ": " + e.message);
	}
	//LogManager.logToConsole("match NOT found");
	return false;
}

// HACK: Using a string bundle to format a time. Unfortunately, format() function isn't
// exposed in any other way (bug 451360).
var timeFormat = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService)
													 .createBundle("data:text/plain,format=" + encodeURIComponent("%02S:%02S:%02S.%03S"));
function formatTime(time)
{
	return timeFormat.formatStringFromName("format", [time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds()], 4);
}










