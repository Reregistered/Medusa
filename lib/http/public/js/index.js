/**
 @example_title List
 @example_order 42
 @example_html
 <div id='logs' style='width: 100%; height: 400px;'></div>
 */
var loggers = {};
var activeLoggers = {};

var numLoggers = 0;

// custom formatter for duration column
function formatTime (t) {

  return new Date(t).toLocaleTimeString();
  var d= new Date();
  d.setTime(t);
  return d.toLocaleTimeString();
}

// formatter for highlighted strings
var hlt = '';
function formatHlted (t) {
  return t;
  return hlt ? (t || '').replace(hlt, '<strong>' + hlt + '</strong>') : t;
}

var p = uki(
  { view: 'HSplitPane', rect: '1000 660', anchors: 'top left right bottom', handleWidth: 1,
    leftMin: 200, rightMin: 100, handlePosition: 200,
    leftChildViews: [ // scrollable list on the left
      { view: 'ScrollPane', rect: '200 650', anchors: 'top left right bottom',
        // with a wrapping box (test background and border)
        childViews: { view: 'Box', rect: '10 10 180 900', anchors: 'top left right bottom', background: '#CCC',
          // with indierect child list
          childViews: { view: 'uki.view.Table', rect: '1 1 178 900', anchors: 'top left right bottom',
            columns: [
              // left part
              { view: 'table.CustomColumn', label: 'Logger', resizable: true, minWidth: 100, width: 200, formatter: formatHlted
            }],
            rowHeight: 23, id: 'logger_list', throttle: 0, multiselect: true, textSelectable: false }
        }
      }
    ],

    rightChildViews: [ // other controlls on the right
      { view: 'ScrollPane', rect: '200 650', anchors: 'top left right bottom',
        // with a wrapping box (test background and border)
        childViews: { view: 'Box', rect: '10 10 180 9000', anchors: 'top left right bottom', background: '#CCC',
          // with indierect child list
          childViews: { view: 'uki.view.Table', rect: '1 1 178 9000', anchors: 'top left right bottom',
            columns: [
              // left part
              { view: 'table.CustomColumn', label: 'Title', resizable: true, minWidth: 50,width: 130, formatter: formatHlted },
              { view: 'table.CustomColumn', label: 'Class', resizable: true, minWidth: 50, width: 130, formatter: formatHlted },
              { view: 'table.CustomColumn', label: 'Message', resizable: true, minWidth: 100, width: 750, formatter: formatHlted },
              { view: 'table.CustomColumn', label: 'Level', resizable: true, minWidth: 50, width: 100, formatter: formatHlted },
              { view: 'table.NumberColumn', label: 'Time', resizable: true, minWidth: 50, width: 100, formatter: formatTime }
            ],
            rowHeight: 23, id: 'logs_list', throttle: 0, multiselect: true, textSelectable: false }
        }
      }
    ]
  }
).attachTo( document.getElementById('logs'), '400 700' );


/////////////////////////////////////////////////////////////////
//


var m_socket = io.connect(null,{resource:'log/socket.io'});
m_socket.on('connect', function () {

  if (!m_socket.init){

    m_socket.init = true;
    m_socket.on('loggers:new', function(data){
      console.log(data);

      for (var itr in  data){
        if (data.hasOwnProperty(itr)){

          if (!(itr in loggers)){
            uki('#logger_list').addRow(0,[itr]);

            numLoggers++;

            loggers[itr]=1;
          }
        }
      }
    });

    m_socket.on('loggers:removed', function(data){
      console.log(data);
      var list = uki('#logger_list');
      var lData = list.data();

      var rItr = numLoggers-1;
      // find the logger, and remove it.
      while (rItr >=0){

        var key = lData[rItr][0];

        if (key in data){


          if (key in activeLoggers){
            delete activeLoggers[key];
          }
          if (key in loggers){
            delete loggers[key];
          }

          // it needs to be remove
          list.removeRow(rItr);
          numLoggers--;

        }

        rItr--;
      }

    });

    m_socket.on('log', function(data){
      //console.log(data);

      uki('#logs_list').addRow(0,[
        data.title,
        data.class,
        data.msg,
        data.level,
        data.timestamp]);
    });

    m_socket.on('disconnect', function () {

      // clean everything up
      var list = uki('#logger_list');

      // find the logger, and remove it.
      while (numLoggers){
          list.removeRow(0);
          numLoggers--;
      }

      loggers={};

    });
    }

});


// now register for list change events
uki('#logger_list').bind('click', function() {


  //////////////////////////////
  // unsub from existing loggers
  m_socket.emit('loggers:unsub',activeLoggers);

  activeLoggers = {};

  //////////////////////////////
  // sub to new ones
  var indexes = this.selectedIndexes();

  for (var itr=0; itr < indexes.length; itr++ ){
    if (this.data()[indexes[itr]][0]){
      activeLoggers[this.data()[indexes[itr]][0]] = 1;
    }
  }

  m_socket.emit('loggers:sub',activeLoggers);

});
