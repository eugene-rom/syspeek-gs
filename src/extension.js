/* global imports */

const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

let button, index;
let icons = [];
let enabled = false;
let statFile;

//function onClick() {
//    button.set_child(icons[index++]);
//}

function convertString(line) {
    var a = line.split(' ');
    a = a.filter( function(n) { return n !== ''; } ); 
    a.shift();
    a.splice(7, 3);
    return a.map(Number);
}

const IDLE = 3;
let last_total = 0;
let last_busy = 0;


function read_line(dis, result)
{
    var [line, length] = dis.read_line_finish_utf8(result);
    dis.close(null);

    if (line === null) {
        return;
    }

    //global.log( 'syspeek-gs', 'Line: ' + line );
    var stats = convertString( line );
    var total = stats.reduce( (a, b) => a + b, 0 );
    var busy = total - stats[IDLE];
   
    var delta_total = total - last_total;
    var delta_busy = busy - last_busy;
    
    var percentage = 0;
    if ( ( delta_total > 0 ) && ( delta_busy > 0 ) ) {
        percentage = (delta_busy / delta_total) * 100;
    }
    
    update(percentage);

    last_total = total;
    last_busy = busy;
}

function read_stat() {
    try {
        var dis = Gio.DataInputStream.new( statFile.read(null) );
        dis.read_line_async( GLib.PRIORITY_DEFAULT, null, read_line );
    } catch (e) {
        global.log( 'syspeek-gs', 'Error: ' + e.message );
    };
}

function update( percentage ) {
    button.set_child( icons[ Math.trunc(percentage / 10) ] );
}

function init() 
{
    statFile = Gio.File.new_for_path('/proc/stat');
    
    button = new St.Bin({ style_class: 'panel-button',
                          reactive: true,
                          can_focus: true,
                          x_fill: true,
                          y_fill: false,
                          track_hover: true });
    
    for ( let i = 0; i <= 100; i += 10 ) {
        let icon = new St.Icon( { icon_name: 'syspeek-' + i + '-symbolic',
                                  icon_size: 28 } );
        //button.set_child(icon);
        icons.push(icon);
    }
    
    button.set_child(icons[0]);
    //button.connect('button-press-event', onClick);
}

function enable() 
{
    index = 0;
    last_total = 0;
    last_busy = 0;
    enabled = true;

    Main.panel._rightBox.insert_child_at_index(button, 0);

    Mainloop.timeout_add_seconds( 1, function() {
        read_stat();            
        return enabled;
    });
}

function disable() {
    enabled = false;
    Main.panel._rightBox.remove_child(button);
}
