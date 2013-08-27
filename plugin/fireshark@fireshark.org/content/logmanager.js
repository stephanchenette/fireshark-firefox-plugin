
var EXPORTED_SYMBOLS = ["LogManager"];

var LogManager = {

	init: function () {

		try {
			
			this.init = false;
			
			this.consoleService = Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService);

			this.logstream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
				.createInstance(Components.interfaces.nsIConverterOutputStream);

			this.openstream("reportlog.txt", this.logstream);

			this.logToConsole("Logging initialized");  
				
		}
		catch(e) {

			this.logToConsole(e);
		}
	},

	shutdown: function () {

		try {
		
			this.closestream(this.logstream);
				
		}
		catch(e) {
		
			this.logToConsole("exception caught in shutdown " + e);
		}

	},// nsIConverterOutputStream stream
	closestream: function(stream) {
		
		try {
		
			stream.close(); // this closes foStream
		}
		catch(e) {
		
			this.logToConsole("exception caught in closestream " + e);
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

			//this.logToConsole("log stream location " + file.path);
						
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
			this.logToConsole("exception caught in openstream " + e);
			return false;
		}
		
		return false;
	},

	logToConsole: function (str) {

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

