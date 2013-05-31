/**
 * Module dependencies.
 */
var nullfn = function(){};

var  path=require('path')
   , util = require('util')
   , redis = require('redis')
   , config = require(path.join('..','..','config','config'))
   , consts = require(path.join('..','..','constants'))
   , winston = require('winston');

var wr = require(path.join('..','medusa')).Medusa;

var rc = undefined;
var rcPub = undefined;
var graylogHost = undefined;

var loggers = {};

function reportErrors(err, reply) {
  if (err) {
    console.log("Error: " + err);
  }
}


///////////////////////////////////////////
// setup socket.io to send log messages to
// everyone connected
var newlog = function(channel,data){

  var logData = JSON.parse(data); 
  var level =  logData.level || 'info';
  // push it to the proper graylog logger
  loggers[channel][level](logData.msg, logData.meta);

};

// this function will poll the redit db to get all the connected logging instances
// it will then update its subscription and push the list of loggers to the website
// we need to resolve add and removed, so we will push two events
// loggers:new
// loggers:removed
var updateLoggers = function(){

  var newLoggers = [];

  //////////////////////////////////////////
  if (rc && rcPub){

    // get the list of loggers
    rc.smembers([consts.MEDUSA_LOGGERS],function(err,res){
      // now check which ones are still around
      var existMulti = rc.multi();
      var len = res.length;
      for(var itr = 0 ; itr < len; itr ++){
        newLoggers[itr] = res[itr];
        existMulti.exists(res[itr]);
      }

      var updateRedisLoggers = rc.multi();
      existMulti.exec(function(err,existResults){
        for (var itr=0, len = existResults.length; itr < len ; ++ itr){

          // if it doesn't exist remove it from the set
          if (!existResults[itr]){
            updateRedisLoggers.srem([consts.MEDUSA_LOGGERS, newLoggers[itr]]);
            if(loggers[newLoggers[itr]]){
              rcPub.unsubscribe(newLoggers[itr]);
              delete loggers[newLoggers[itr]];
            }
          } else {
            if(!loggers[newLoggers[itr]]){
              rcPub.subscribe(newLoggers[itr]);

              loggers[newLoggers[itr]] = new (winston.Logger)();

              if (graylogHost){
                loggers[newLoggers[itr]].add(require('winston-graylog2').Graylog2, {graylogHost:graylogHost, graylogHostname:newLoggers[itr]});
              } else {
                loggers[newLoggers[itr]].add(winston.transports.Console, {timestamp: true});
              }
            }
          }
        }
        updateRedisLoggers.exec(reportErrors);
      });
    });
  }
};

module.exports = {};
module.exports.init = function(params, cb){

  cb = cb || nullfn;

  graylogHost = params.graylogHost;

  ///////////////////////////////////////////////
  // create the redis connection
  // connect to the DB
  try {
    // Redis configuration settings
    var redisConfig = {
      port   :params.port || 6379,
      host   :params.host || '127.0.0.1',
      options:{
        return_buffer:false
      }
    };

    var Redis = require('redis');
    var db = Redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
    db.max_attempts = 1;

    var onError = function (err) {
      winston.error('could not connect to the DB');
      cb(new Error('Could not connect to Redis'), null);
    };

    var onConnect = function () {

      winston.info('Connected to the log DB');

      rc = db;

      // call the first update logger
      updateLoggers();

      cb(null, db);

    };

    db.on('error', onError);
    db.on("connect", onConnect);

    /////////////////////////////////////////////////////
    // Also set up the pub/sub
    var dbPubSub = Redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
    dbPubSub.max_attempts = 1;
    dbPubSub.on('error', function (err) {
      /////////////////////////////////
    });

    dbPubSub.on('connect', function () {
      winston.info('Connected to the pubSub DB');

      rcPub = dbPubSub;

      dbPubSub.on('message', newlog);

      updateLoggers();
    });

  } catch (err) {
    cb(new Error('Redis unavailable'), null);
  }

  setInterval(updateLoggers, config.loggerInterval);

};
