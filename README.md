Medusa
======

Very simple redis transport and log server for Winston.

As Logger

  var winston = require('winston');
  var wr = require('medusa').Medusa;

  winston.add(wr, { class:'ResourceManager',
				    title: 'RM',
				    host: 'redisIP',				    
				    port:6379});


As Server

	node server.js -h re.di.s.ip -p redis_port -s server_port


Access the log server via serverip:server_port to see the logging in realtime. 
