/*
 * Medusa.js: A fixed-length Redis transport and Log server for Winston
 *
 * (C) 2011, Charlie Robbins
 * (C) 2012, Dov Amihod
 */

var path = require('path'),
    redis = require('redis'),
    winston = require('winston'),
    common = require('winston/lib/winston/common'),
    util = require('util'), 
    consts = require('../constants.js');
    
var Medusa = exports.Medusa = function (options) {

  var self = this;

  options       = options || {};
  options.host  = options.host || 'localhost';
  options.port  = options.port || 6379;
  options.debug = options.debug || false;

  this.name = 'redis';
  this.redis = redis.createClient(options.port, options.host);
  this.pubRedis = redis.createClient(options.port, options.host);

  this.json = options.json || false;

  //////////////////////////////////////////////
  // we will limit the log list to this value
  this.length = options.length    || 5000;

  this.class = options.class     || ''
  this.title = options.title     || process.title + '-' + process.pid;
  this.persist = (options.hasOwnProperty('persist')) ?  options.persist : true;

  this.interval = 0;

  this.expireLogger = 10000; // expire the logger after 10 seconds
  this.expireLogs = 1000*60*60*24*5; // expire the logs after 5 days

  this.container = consts.CONTAINER_PREFIX + this.title;

  this.timestamp = options.timestamp || true;

  if (options.auth) {
    this.redis.auth(options.auth);
  }
  
  // Suppress errors from the Redis client
  this.redis.on('error', function (err) { 
    self.emit('error',err);
  });

  this.pubRedis.on('error', function (err) { 
    self.emit('error',err);
  });

  this.redis.on('connect', function (err) {

    var key = consts.LOGGER_PREFIX + self.title;

    var multi = self.redis.multi();

    // this key is used to track the lifetime of the logger
    multi.set([key,1]);
    multi.sadd([consts.MEDUSA_LOGGERS, key]);
    multi.exec(function(err, results){
      var setExpire = function(){
        //set the expiration
        self.redis.expire([key,Math.floor(self.expireLogger/1000)], function(){});
      };
      setExpire();
      self.interval = setInterval(setExpire,Math.floor(self.expireLogger*0.8));
    });

    ////////////////////////////////////////
    // add the queue and set that to expire as well
    var queueKey = self.container;
    self.redis.lpush(queueKey, '--- Starting ---', function(){
      // expire the queue after 5 days.
      var setExpire = function(){
        //set the expiration
        var ex = Math.floor(self.expireLogs/1000);
        self.redis.expire([queueKey,ex], function(){});
      };
      var ex = Math.floor(self.expireLogs*0.95);
      self.interval = setInterval(setExpire,ex);
      setExpire();
    })
  });

  this.redis.on('disconnect', function (err) {
    // kill the interval
    if (self.interval){
      clearInterval(self.interval);
      self.interval = 0;
    }
  });

  return this;

};  

//
// Inherit from `winston.Transport`.
//
util.inherits(Medusa, winston.Transport);

//
// Define a getter so that `winston.transports.Redis` 
// is available and thus backwards compatible.
//
winston.transports.Medusa = Medusa;

//
// ### function log (level, msg, [meta], callback)
// Core logging method exposed to Winston. Metadata is optional.
//
Medusa.prototype.log = function (level, msg, meta, callback) {
  var self = this;

  var key = consts.LOGGER_PREFIX + self.title;

  var output = JSON.stringify({level:level,
    title:this.title,
    class:this.class,
    msg:msg,
    data: meta,
    timestamp: Date.parse(new Date())});

  //PUBLISH channel message
  //Post a message to a channel
  if (this.persist){

    ////////////////////////////////////////
    // save to the DB's
    // save to my list
    self.redis.lpush(self.container, output, function (err,listLen) {
      if (err) {
        return self.emit('error', err);
      }

      if (listLen > self.length){
        self.redis.ltrim(self.container, 0, self.length, function () {
          if (err) {
            return self.emit('error', err);
          }
          self.emit('logged');
        });
      }else{
        self.emit('logged');
      }
    });
  }

  /////////////////////////////////////////////////////
  // done with the loggin, so publish
  self.pubRedis.publish([key,output]);

  callback(null, true);
};