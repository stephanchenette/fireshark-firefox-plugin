
/*

Copyright 2007-2009 Stephan Chenette

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

// import singleton objects
Components.utils.import("resource://content/logmanager.js");
Components.utils.import("resource://content/fireshark.js");
Components.utils.import("resource://content/utils.js");
Components.utils.import("resource://content/jsdiff.js");

var FSStateEnum = {
	PRE 	: {value: 0, name: "Pre"}, 
  	GO	: {value: 1, name: "Start"}, 
  	PAUSE 	: {value: 2, name: "Pause"},
	RESUME 	: {value: 3, name: "Resume"},
  	STOP 	: {value: 4, name: "Stop"}
};

var gFSState = FSStateEnum.PRE;
var gFSDialogRunning = false; // used to check if instance of fireshark dialog is already running

var fsParams = {};

function onFSWinLoad() {

	try {
		//LogManager.logToConsole("==================== onFSWinLoad called");

		gFSDialogRunning = true;

		document.getElementById('fswin-startPauseButton').disabled=true;
		document.getElementById('fswin-stopButton').disabled=true;
		document.getElementById('fswin-clearButton').disabled=true;

		loadDialog();

		//LogManager.logToConsole("onFSWinLoad registering callback");
		Fireshark.registerCallback(firesharkwinEventCallback);

	} catch(e) {
		
		LogManager.logToConsole("onFSWinLoad caught an exception: " + e.name + ": " + e.message);
	}
}

function onFSWinUnLoad() {

	try {
		//LogManager.logToConsole("==================== onFSWinUnLoad called");

		gFSDialogRunning = false;

		//LogManager.logToConsole("onFSWinUnLoad unregistering callback");
		Fireshark.unregisterCallback(firesharkwinEventCallback);

	} catch(e) {

		LogManager.logToConsole(e);
	}
}

function buildChildTree(treechildren, eventDomArray) {

	try {
		//LogManager.logToConsole("buildChildTree called");

		//LogManager.logToConsole("buildChildTree eventDomArray.length = " + eventDomArray.length);

		for(var j=0; j<eventDomArray.length; j++) {

			//LogManager.logToConsole("buildChildTree url " + eventDomArray[j].url + " name " + eventDomArray[j].name);

			var titem = document.createElement("treeitem");
			titem.setAttribute("domfilepath", eventDomArray[j].filepath);
			titem.setAttribute("srcfilepath", eventDomArray[j].srcfile);

			if(eventDomArray[j].childdoms.length > 0) {

				titem.setAttribute("container", "true");
			}

			var trow = document.createElement("treerow");

			var tcellurl = document.createElement("treecell");
			tcellurl.setAttribute("label", eventDomArray[j].url);

			var tcelltype = document.createElement("treecell");
			tcelltype.setAttribute("label", eventDomArray[j].name);	

			trow.appendChild(tcellurl);
			trow.appendChild(tcelltype);

	 		titem.appendChild(trow);

			if(eventDomArray[j].childdoms.length > 0) {

				var titemchildren = document.createElement("treechildren");
				titem.appendChild(titemchildren);
				
				//var childdoms = eventDomArray[j].childdoms;
				buildChildTree(titemchildren, eventDomArray[j].childdoms);
			}

			treechildren.appendChild(titem);
		}


	} catch(e) {

		LogManager.logToConsole("buildChildTree caught an exception: " + e.name + ": " + e.message);
	}
}

function firesharkwinEventCallback(event) {

	try {
		//LogManager.logToConsole("firesharkwinEventCallback called event.eventType = " + event.eventType);

		var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
		var eventJSONStr = nativeJSON.encode(event);

		// update events tab
		document.getElementById('fswin-ouput').value += eventJSONStr + "\n\n";

		// update network tab
		if(event.eventType == "connection") {

			//LogManager.logToConsole("firesharkwinEventCallback connection event receieved");

			var ti = document.getElementById('fswin-nettree');

			for (i=0; i < ti.childNodes.length; i++) {

      				if (ti.childNodes[i].nodeName == "treechildren") {

					var tc = ti.childNodes[i];

				 	var titem = document.createElement("treeitem");
				 	var trow = document.createElement("treerow");

				 	var tcellsrc = document.createElement("treecell");
					var tcelldst = document.createElement("treecell");
					var tcelltype = document.createElement("treecell");

				 	tcellsrc.setAttribute("label", event.src);
					tcelldst.setAttribute("label", event.dst);
					tcelltype.setAttribute("label", event.type);

					trow.appendChild(tcellsrc);
					trow.appendChild(tcelldst);
					trow.appendChild(tcelltype);

				 	titem.appendChild(trow);
				 	tc.appendChild(titem);

					//LogManager.logToConsole("firesharkwinEventCallback added connection to tree");

					return;
				}
			}
		} else if(event.eventType == "loadurlsend") {
			
			var startPauseButton = document.getElementById('fswin-startPauseButton');
			
			Fireshark.stop();

			startPauseButton.label = FSStateEnum.GO.name;
			gFSState = FSStateEnum.PRE;

			toggleForStartStop(false);

		} else if(event.eventType == "loadurlsstart") {

			var ti = document.getElementById('fswin-nettree');

			for (i=0; i < ti.childNodes.length; i++) {

				if (ti.childNodes[i].nodeName == "treechildren") {

					var tc = ti.childNodes[i];

	  				while(tc.hasChildNodes()){
	    					tc.removeChild(tc.firstChild);
	  				}

					break;
				}
			}

			//LogManager.logToConsole("firesharkwinEventCallback clearing the content tree");
			var ti2 = document.getElementById('fswin-contenttree');

			//LogManager.logToConsole("firesharkwinEventCallback tree length = " + ti2.childNodes.length);
			for (i=0; i < ti2.childNodes.length; i++) {

				//LogManager.logToConsole("firesharkwinEventCallback node name = " + ti2.childNodes[i].nodeName);

				if (ti2.childNodes[i].nodeName == "treechildren") {

					var tc = ti2.childNodes[i];

	  				while(tc.hasChildNodes()){
	    					tc.removeChild(tc.firstChild);
	  				}

					break;
				}
			}

		} else if(event.eventType == "contentloaded") {

			// update contents tab
			//document.getElementById('fswin-contentouput').value += eventJSONStr + "\n\n";

			var ti = document.getElementById('fswin-contenttree');

			for (i=0; i < ti.childNodes.length; i++) {

				if (ti.childNodes[i].nodeName == "treechildren") {

					var tc = ti.childNodes[i];

	  				buildChildTree(tc, event.doms);

					break;
				}
			}
		}

	} catch(e) {
		
		LogManager.logToConsole("firesharkwinEventCallback caught an exception: " + e.name + ": " + e.message);
	}
}

function loadDialog() {

	try {
		
		//LogManager.logToConsole("loadDialog called");
		
		var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);
		
		document.getElementById('fswin-urlfile').disabled=true;
		document.getElementById('fswin-saveLocation').disabled=true;

		//document.getElementById('fswin-startPauseButton').disabled=true;
		//document.getElementById('fswin-stopButton').disabled=true;
		//document.getElementById('fswin-clearButton').disabled=true;

		/* Options */
		var d_httpReferrer = prefManager.getCharPref("extensions.fireshark.options.default.httpReferrer");
		var d_httpUserAgent = prefManager.getCharPref("extensions.fireshark.options.default.httpUserAgent");
		var d_uriLoadTimeout = prefManager.getIntPref("extensions.fireshark.options.default.uriLoadTimeout");
		var d_savePath = prefManager.getCharPref("extensions.fireshark.options.default.savePath");
		var d_httpProxyEnabled = prefManager.getBoolPref("extensions.fireshark.options.default.httpProxyEnabled");
		var d_httpProxy = prefManager.getCharPref("extensions.fireshark.options.default.httpProxy");
		var d_httpProxyPort = prefManager.getIntPref("extensions.fireshark.options.default.httpProxyPort");

		// Default browser user-agent
		var ua = window.navigator.userAgent;
		var sys_httpUserAgent = ua;
		
		var u_httpReferrer = prefManager.getCharPref("extensions.fireshark.options.user.httpReferrer");
		var u_httpUserAgent = prefManager.getCharPref("extensions.fireshark.options.user.httpUserAgent");
		var u_uriLoadTimeout = prefManager.getIntPref("extensions.fireshark.options.user.uriLoadTimeout");
		var u_savePath = prefManager.getCharPref("extensions.fireshark.options.user.savePath");
		var u_httpProxyEnabled = prefManager.getBoolPref("extensions.fireshark.options.user.httpProxyEnabled");
		var u_httpProxy = prefManager.getCharPref("extensions.fireshark.options.user.httpProxy");
		var u_httpProxyPort = prefManager.getIntPref("extensions.fireshark.options.user.httpProxyPort");
				
		// Profile directory		   
   		var profileD = Components.classes["@mozilla.org/file/directory_service;1"].  
               		getService(Components.interfaces.nsIProperties).  
                      	get("ProfD", Components.interfaces.nsIFile);  
		
		var profileDir = profileD.path;
		var sys_savePath = profileDir;

		// HTTP referrer
		if(u_httpReferrer != undefined && u_httpReferrer.length > 0) {
			document.getElementById('fswin-httpReferrer').value=u_httpReferrer;
		} else {
			document.getElementById('fswin-httpReferrer').value=d_httpReferrer;
		}

		// HTTP user-agent
		if(u_httpUserAgent != undefined && u_httpUserAgent.length > 0) {
			document.getElementById('fswin-httpUserAgent').value=u_httpUserAgent;
		} else {
			document.getElementById('fswin-httpUserAgent').value=sys_httpUserAgent;
		}

		// URL load timeout
		if(u_uriLoadTimeout != undefined && u_uriLoadTimeout > 0) {
			document.getElementById('fswin-urlLoadTimeout').value=u_uriLoadTimeout;
		} else {
			document.getElementById('fswin-urlLoadTimeout').value=d_uriLoadTimeout;
		}

		// Save file location
		if(u_savePath != undefined || u_savePath.length > 0) {
			document.getElementById('fswin-saveLocation').value=u_savePath;
		} else {
			document.getElementById('fswin-saveLocation').value=sys_savePath;
		}
		
		// Use proxy
		
		if(u_httpProxyEnabled != undefined && u_httpProxyEnabled == true) {
			document.getElementById('fswin-proxyenabled').checked=true;
			document.getElementById('fswin-proxy').disabled=false;
			document.getElementById('fswin-proxyPort').disabled=false;
		} else if(u_httpProxyEnabled != undefined && u_httpProxyEnabled == false) {
			document.getElementById('fswin-proxyenabled').checked=false;
			document.getElementById('fswin-proxy').disabled=true;
			document.getElementById('fswin-proxyPort').disabled=true;
		} else if(d_httpProxyEnabled != undefined && u_httpProxyEnabled == true) {
			document.getElementById('fswin-proxyenabled').checked=true;
			document.getElementById('fswin-proxy').disabled=false;
			document.getElementById('fswin-proxyPort').disabled=false;
		} else {
			document.getElementById('fswin-proxyenabled').checked=false;
			document.getElementById('fswin-proxy').disabled=true;
			document.getElementById('fswin-proxyPort').disabled=true;
		}
		
		// Proxy
		if(u_httpProxy != undefined && u_httpProxy.length > 0 ) {
			document.getElementById('fswin-proxy').value = u_httpProxy;
		} else {
			document.getElementById('fswin-proxy').value = d_httpProxy;
		}
		
		if(u_httpProxyPort != undefined && u_httpProxyPort > 0) {
			document.getElementById('fswin-proxyPort').value = u_httpProxyPort;
		} else {
			document.getElementById('fswin-proxyPort').value = d_httpProxyPort;
		}
		
	} catch(e) {
		
		LogManager.logToConsole("loadDialog caught an exception: " + e.name + ": " + e.message);
	}
}

function onRestoreDefaultsOptionsButton() {
	
	try {
	
		var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);

		prefManager.setCharPref("extensions.fireshark.options.user.httpReferrer", 
			prefManager.getCharPref("extensions.fireshark.options.default.httpReferrer"));

		prefManager.setCharPref("extensions.fireshark.options.user.httpUserAgent",
			prefManager.getCharPref("extensions.fireshark.options.default.httpUserAgent"));

		prefManager.setIntPref("extensions.fireshark.options.user.uriLoadTimeout",
			prefManager.getIntPref("extensions.fireshark.options.default.uriLoadTimeout"));

		// Profile directory		   
   		var profileD = Components.classes["@mozilla.org/file/directory_service;1"].  
               		getService(Components.interfaces.nsIProperties).  
                      	get("ProfD", Components.interfaces.nsIFile);  
		
		var profileDir = profileD.path;
		var sys_savePath = profileDir;
		
		prefManager.setCharPref("extensions.fireshark.options.user.savePath", sys_savePath);
			
		prefManager.setBoolPref("extensions.fireshark.options.user.httpProxyEnabled",
			prefManager.getBoolPref("extensions.fireshark.options.default.httpProxyEnabled"));
			
		prefManager.setCharPref("extensions.fireshark.options.user.httpProxy",
			prefManager.getCharPref("extensions.fireshark.options.default.httpProxy"));
			
		prefManager.setIntPref("extensions.fireshark.options.user.httpProxyPort",
			prefManager.getIntPref("extensions.fireshark.options.default.httpProxyPort"));

		loadDialog();
	
	} catch(e) {
		
		LogManager.logToConsole(e);	
	}
}

function onSaveOptionsButton() {
	
	try {
	
		var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                			.getService(Components.interfaces.nsIPrefBranch);

		prefManager.setCharPref("extensions.fireshark.options.user.httpReferrer", 
			document.getElementById('fswin-httpReferrer').value);
		prefManager.setCharPref("extensions.fireshark.options.user.httpUserAgent",
			document.getElementById('fswin-httpUserAgent').value);
		prefManager.setIntPref("extensions.fireshark.options.user.uriLoadTimeout",
			document.getElementById('fswin-urlLoadTimeout').value);
		prefManager.setCharPref("extensions.fireshark.options.user.savePath",
			document.getElementById('fswin-saveLocation').value);
		prefManager.setBoolPref("extensions.fireshark.options.user.httpProxyEnabled",
			document.getElementById('fswin-proxyenabled').checked);
			
		prefManager.setCharPref("extensions.fireshark.options.user.httpProxy",
			document.getElementById('fswin-proxy').value);
		prefManager.setIntPref("extensions.fireshark.options.user.httpProxyPort",
			document.getElementById('fswin-proxyPort').value);
	
	} catch(e) {
		
		LogManager.logToConsole("onSaveOptionsButton caught an exception: " + e.name + ": " + e.message);	
	}
}

function toggleEnabled(el) {

	try {

		if(el.disabled == true) {

			el.disabled = false;

		} else {

			el.disabled = true;
		}

	} catch(e) {
		
		LogManager.logToConsole(e);
	}
}

function openDirPicker() {

    	try {
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, "Select a File", nsIFilePicker.modeGetFolder);
		var res = fp.show();
		if (res == nsIFilePicker.returnOK){
			var thefile = fp.file;
			document.getElementById('fswin-saveLocation').value=thefile.path;
			document.getElementById('fswin-saveLocation').disabled=true;
			// --- do something with the file here ---
		}
	}
	catch(e) {

		LogManager.logToConsole(e);
	}
}

function openFilePicker() {

    	try {
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, "Select a File", nsIFilePicker.modeOpen);
		var res = fp.show();
		if (res == nsIFilePicker.returnOK){
			var thefile = fp.file;
			document.getElementById('fswin-urlfile').value=thefile.path;
			document.getElementById('fswin-urlfile').disabled=false;
			document.getElementById('fswin-startPauseButton').disabled=false;
			
			// --- do something with the file here ---
		}
	}
	catch(e) {

		LogManager.logToConsole(e);
	}
}


function inputToJSON() {

	try {

		fsParams.urls = [];
		fsParams.urls.push(document.getElementById('fswin-url').value);
		fsParams.urlFile = document.getElementById('fswin-urlfile').value;

		fsParams.httpReferrer = document.getElementById('fswin-httpReferrer').value;
		fsParams.httpUserAgent = document.getElementById('fswin-httpUserAgent').value;
		fsParams.urlLoadTimeout = document.getElementById('fswin-urlLoadTimeout').value;
		fsParams.saveLocation = document.getElementById('fswin-saveLocation').value;

		fsParams.httpProxyEnabled = document.getElementById('fswin-proxyenabled').checked;
		fsParams.httpProxy = document.getElementById('fswin-proxy').value;
		fsParams.httpProxyPort = document.getElementById('fswin-proxyPort').value;

	} catch(e) {

		LogManager.logToConsole(e);
	}

}

function onStartPauseButton() {
	

	try {
		
		var startPauseButton = document.getElementById('fswin-startPauseButton');
		var stopButton = document.getElementById('fswin-stopButton');
		var clearButton = document.getElementById('fswin-clearButton');
		var urlFileUploadButton = document.getElementById('fswin-upload');

		var urlTextbox = document.getElementById('fswin-url');
		var urlFileTextbox = document.getElementById('fswin-urlfile');

		if(gFSState == FSStateEnum.PRE) {

			gFSState = FSStateEnum.GO;
			startPauseButton.label = FSStateEnum.PAUSE.name;

			inputToJSON();

			var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
			var jsonStr = nativeJSON.encode(fsParams);
			
			LogManager.logToConsole("Starting Fireshark locally with params " + jsonStr);

			// start Fireshark
			Fireshark.start(jsonStr);
			
		} else if(gFSState == FSStateEnum.GO) {

			gFSState = FSStateEnum.PAUSE;
			startPauseButton.label = FSStateEnum.RESUME.name;

		} else if(gFSState = FSStateEnum.PAUSE) {

			gFSState = FSStateEnum.GO;
			startPauseButton.label = FSStateEnum.PAUSE.name;

		} 

		toggleForStartStop(true);

	} catch(e) {

		LogManager.logToConsole(e);
	}
}

function onStopButton() {
	
	try {
	
		var startPauseButton = document.getElementById('fswin-startPauseButton');
		var stopButton = document.getElementById('fswin-stopButton');
	
		if(gFSState == FSStateEnum.GO) {

			gFSState = FSStateEnum.STOP;
			startPauseButton.label = FSStateEnum.GO.name;

		} else if(gFSState = FSStateEnum.PAUSE) {

			gFSState = FSStateEnum.STOP;
			startPauseButton.label = FSStateEnum.GO.name;
		} 

		Fireshark.stop();

		gFSState = FSStateEnum.PRE;

		toggleForStartStop(false);
	
	} catch(e) {
		
		LogManager.logToConsole(e);
	}
}

function toggleForStartStop(isStart) {

	try {

		var startPauseButton = document.getElementById('fswin-startPauseButton');
		var stopButton = document.getElementById('fswin-stopButton');
		var clearButton = document.getElementById('fswin-clearButton');
		var urlFileUploadButton = document.getElementById('fswin-upload');

		var urlTextbox = document.getElementById('fswin-url');
		var urlFileTextbox = document.getElementById('fswin-urlfile');

		if(isStart == true) {

			stopButton.disabled = false;
			clearButton.disabled = false;

			urlFileUploadButton.disabled = true;

			urlTextbox.disabled = true;
			urlFileTextbox.disabled = true;
			
			//document.getElementById('fswin-ouput').value = '';
			//document.getElementById('fswin-contentouput').value = '';

		} else {

			//stopButton.disabled = true;
			//clearButton.disabled = true;

			urlFileUploadButton.disabled = false;

			urlTextbox.disabled = false;
			urlFileTextbox.disabled = false;
		}

	} catch(e) {

		LogManager.logToConsole(e);
	}

}

function onTreeClearButton() {
	
	try {
	
		var ti = document.getElementById('fswin-nettree');

		for (i=0; i < ti.childNodes.length; i++) {

			if (ti.childNodes[i].nodeName == "treechildren") {

				var tc = ti.childNodes[i];

  				while(tc.hasChildNodes()){
    					tc.removeChild(tc.firstChild);
  				}

				return;
			}
		}
	
	} catch(e) {
		
		LogManager.logToConsole("onTreeClearButton caught an exception: " + e.name + ": " + e.message);
	}
}

function onClearButton() {
	
	try {
	
		document.getElementById('fswin-ouput').value = '';
	
	} catch(e) {
		
		LogManager.logToConsole(e);
	}
}

function onContentTreeSelect() {

	try {
		var view = document.getElementById("fswin-contenttree").view;
		var sel = view.selection.currentIndex; //returns -1 if the tree is not focused
		if(sel != -1) {

			var treeItem = view.getItemAtIndex(sel);
			var domfilepath = treeItem.getAttribute('domfilepath');
			var srcfilepath = treeItem.getAttribute('srcfilepath');
			//LogManager.logToConsole("domfilepath = " + domfilepath);


			// update contents tab
			document.getElementById('fswin-dompath').value = domfilepath;
			document.getElementById('fswin-srcpath').value = srcfilepath;
		}

	} catch(e) {
		
		LogManager.logToConsole(e);
	}
}
