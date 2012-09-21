///////////////////////////////////////////////////////////////////////////
// The server can be used to run a small UI for the logging sessions.
// The UI was inspired from kue

var path = require('path')
  , args = require("optimist").usage('Usage: $0 ')
    .default('host',   '127.0.0.1')
    .default('port',   '6379')
    .default('server', '8010')
    .argv;

/////////////////////////////////////////////////
// we expect that the redis server and port
// will be passed on the command line.

app = require(path.join(__dirname,'lib','http'));

app.init({host:args.host,port:args.port});

app.listen(args.server);
