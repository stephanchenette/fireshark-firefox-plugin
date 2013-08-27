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

// add a load event to trigger events on firefox startup 


Components.utils.import("resource://content/firesharknet.js");
Components.utils.import("resource://content/logmanager.js");
Components.utils.import("resource://content/fireshark.js");
Components.utils.import("resource://content/utils.js");
Components.utils.import("resource://content/domobserver.js");

	
// commented out as process load was unacceptable
//DOMObserver.start();

window.addEventListener("load", function() {
  
	Components.utils.import("resource://content/firesharknet.js");
	Components.utils.import("resource://content/logmanager.js");
	Components.utils.import("resource://content/fireshark.js");
	Components.utils.import("resource://content/utils.js");

	try {

		//LogManager.logToConsole("load called");

		// initialize singletone log manager
		LogManager.init();

		// initialize singleton fireshark object
		Fireshark.init();

		// start listening for requests w/ network service
		FiresharkNetworkListener.init();
		
	} catch(e) {

		LogManager.logToConsole("overlay load caught an exception: " + e.name + ": " + e.message);
	}

}, false);

// add a unload event to trigger events on firefox exit 
window.addEventListener("unload", function() {
    
	Components.utils.import("resource://content/firesharknet.js");
	Components.utils.import("resource://content/logmanager.js");
	Components.utils.import("resource://content/fireshark.js");

	try {

		FiresharkNetworkListener.shutdown();
	
		Fireshark.shutdown();
		
		// now remove a file in profile to allow others (locally) to know that fireshark is all done
		LogManager.logToConsole("fireshark complete, removing firesharkReady file...");
		RemoveFile("firesharkReady");
		LogManager.logToConsole("fireshark has removed file firesharkReady");
		
		LogManager.logToConsole("fireshark has removed file firesharkReady");
		
		LogManager.shutdown();
		
	} catch(e) {

		LogManager.logToConsole("overlay unload caught an exception: " + e.name + ": " + e.message);
	}

}, false);

// fireshark menu listner
function onMenuItemCommand() {
	
	Components.utils.import("resource://content/firesharknet.js");
	Components.utils.import("resource://content/logmanager.js");
	Components.utils.import("resource://content/fireshark.js");

	try {
		window.open("chrome://fireshark/content/firesharkwin.xul", 
			"_blank", 
			"chrome,resizable,centerscreen");
	
	} catch(e) {

		LogManager.logToConsole("exception caught: " + e);
	}
}

