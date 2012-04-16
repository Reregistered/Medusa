///////////////////////////////////////////////////////////////////////////
// The server can be used to run a small UI for the logging sessions.
// The UI was inspired from kue

var path = require('path')
  , program = require('commander')

/////////////////////////////////////////////////
// we expect that the redis server and port
// will be passed on the command line.

var redisIP = '127.0.0.1';
var redisPort = '6379';
var serverPort = 8010;

program
  .version('0.0.1')
  .option('-h, --host', 'Redis Host (Defaults to ' + redisIP + ')')
  .option('-p, --port', 'Redis port ( Defaults to ' + redisPort + ')')
  .option('-s, --server', 'Server Port ( Defaults to ' + serverPort +')')
  .parse(process.argv);

redisIP = program.host || redisIP;
redisPort = program.port || redisPort;
serverPort = program.server || serverPort;

app = require(path.join(__dirname,'lib','http'));

app.init({host:redisIP ,port:redisPort});

app.listen(serverPort);
