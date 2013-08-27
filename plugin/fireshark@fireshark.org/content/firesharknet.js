
var EXPORTED_SYMBOLS = ["FiresharkNetworkListener"];

// import singleton objects
Components.utils.import("resource://content/logmanager.js");
Components.utils.import("resource://content/fireshark.js");
Components.utils.import("resource://content/utils.js");

var FiresharkNetworkListener = {

	firesharkNetEventCallback: function (event) {

		try {
		
			// import singleton objects
			Components.utils.import("resource://content/logmanager.js");
			Components.utils.import("resource://content/fireshark.js");
			Components.utils.import("resource://content/firesharknet.js");

			//LogManager.logToConsole("firesharkNetEventCallback called eventType = " + event.eventType);

			var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
			jsonStr = nativeJSON.encode(event);
			
			try {
			
				FiresharkNetworkListener.logToEvents(jsonStr);
				
				if(event.eventType == "loadurlsend") {
					//LogManager.logToConsole("firesharkNetEventCallback found loadurlsend event");
					// now drop a file in profile to allow others (locally) to know that fireshark is complete
					LogManager.logToConsole("fireshark complete, creating firesharkDone file...");
					// now drop a file in profile to allow others (locally) to know that fireshark is ready and prepared to accept commands
					saveFileToProfileDir("firesharkDone", "");
					LogManager.logToConsole("fireshark has created file firesharkDone");
		
				}
			
			} catch(e) {
			
				LogManager.logToConsole("firesharkNetEventCallback caught an exception while writing to socket: " + e.name + ": " + e.message);
			}
			
			//LogManager.logToConsole("firesharkNetEventCallback has sent out the event via socket");

		} catch(e) {

			LogManager.logToConsole("firesharkNetEventCallback caught an exception: " + e.name + ": " + e.message);
		}

	},
	
	init: function()
	{
		// Get the root branch
		/*
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefBranch);
		preftext = prefs.getCharPref('browser.startup.homepage');
		//TrajLogging.LIB.log(1, 'homepage=' + preftext);
		var re = new RegExp('http://localhost:(\\d+)/selenium-server');
		var m = re.exec(preftext);
		if( m != null ) {
			this._serverPort = parseInt(m[1]) + 2000;
		}
		*/
		
		try {
		
			//LogManager.logToConsole("FiresharkNetworkListener:init() registering callback");
			Fireshark.registerCallback(this.firesharkNetEventCallback);
				
			LogManager.logToConsole("fireshark ready, creating firesharkReady file...");
			// now drop a file in profile to allow others (locally) to know that fireshark is ready and prepared to accept commands
			saveFileToProfileDir("firesharkReady", "");
			LogManager.logToConsole("fireshark has created file firesharkReady");
		
			this.logstream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
					.createInstance(Components.interfaces.nsIConverterOutputStream);

			this.openstream("events.js", this.logstream);
			
			var arr = new Array();
			
			var profileD = Components.classes["@mozilla.org/file/directory_service;1"].  
							getService(Components.interfaces.nsIProperties).  
								get("ProfD", Components.interfaces.nsIFile);
								
			profileD.append("firesharkURLs");
			var profileDir = profileD.path;
					
			var urlsSuccess = 0;
			
			getFileContents(profileDir, arr);
			
			if(arr.length == 0) {
			
				LogManager.logToConsole("FiresharkNetworkListener:init() firesharkURLs file is empty - unable to start Fireshark on start-up");
				return;
				
			} else {
			
				LogManager.logToConsole("FiresharkNetworkListener:init() read firesharkURLs file");
			}
			
			var command = arr[0];
			LogManager.logToConsole("command in file is " + command);
			
			if(command.length == 0) {
				LogManager.logToConsole("command is empty ...assumming that Fireshark must be running locally");
				return;
			}
							 
			//LogManager.logToConsole("FiresharkNetworkListener:init() starting fireshark object");
					
			// TODO: check to make sure fireshark isn't already started!!
			if(!Fireshark.isRunning()) {
				
				var event = {};
				event.eventType 	= "ok";
				
				var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
				var jsonStr = nativeJSON.encode(event);
			
				FiresharkNetworkListener.logToEvents(jsonStr);
				
				LogManager.logToConsole("Starting fireshark");
				Fireshark.start(command);

			} else {
			
				var event = {};
				event.eventType 	= "alreadyrunning";
				
				var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
				var jsonStr = nativeJSON.encode(event);
			
				FiresharkNetworkListener.logToEvents(jsonStr);
				
				LogManager.logToConsole("Unable to start fireshark, as it's already started");
			}
				
			
		} catch(e) {
		
			LogManager.logToConsole("FiresharkNetworkListener:init() caught an exception " + e.name + ": " + e.message);
		}
	},	  

	shutdown: function()
	{
		LogManager.logToConsole("FiresharkNetworkListener:stop() called");
		//Components.utils.reportError("Command uninit called");
		this.closestream(this.logstream);
	},
	
	closestream: function(stream) {
		
		try {
		
			stream.close(); // this closes foStream
		}
		catch(e) {
		
			LogManager.logToConsole("exception caught in closestream " + e);
		}
	},
	
	openstream: function(filename, stream) {
	
		try {
			// remove any illegal chars http://en.wikipedia.org/wiki/Filename
			filename = filename.replace(/[\/|/\|/?|%|\*|:|\||"|<|>]/g, "");
			//filename = filename.replace(/[^A-Za-z0-9_\.]/g, "");
			
			var file = Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties)
				.get("ProfD", Components.interfaces.nsIFile);

			file.append(filename);

			//LogManager.logToConsole("event stream location " + file.path);
						
			// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
			// file is nsIFile, data is a string
			var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
				.createInstance(Components.interfaces.nsIFileOutputStream);

			// use 0x02 | 0x10 to open file for appending.
			// https://developer.mozilla.org/en/nsIFileOutputStream
			// https://developer.mozilla.org/en/PR_Open#Parameters
			foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0666, 0);

			stream.init(foStream, "UTF-8", 0, 0);
			
			return true;
		}
		catch(e) {
			LogManager.logToConsole("exception caught in openstream " + e);
			return false;
		}
		
		return false;
	},
	
	logToEvents: function (str) {

		try {

			str += "\n";

			// log to console;
			//this.consoleService.logStringMessage(str);
			this.logstream.writeString(str);

		} catch(e) {

			// nothing
		}	
	}
};
