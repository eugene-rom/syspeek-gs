/* global imports */

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;


const ICON_SIZE    = 26;
const COL_IDLE     = 3;
const TEXT_SYSPEEK = 'SysPeek';
const TEXT_SYSMON  = 'System Monitor...';
const TEXT_CPU     = 'CPU: ';
const TEXT_LOGID   = 'syspeek-gs';

let syspeek;
let enabled = false;

class SysPeekGS extends PanelMenu.Button
{
    constructor() {
        super( 0.0, TEXT_SYSPEEK );

        this._last_total = 0;
        this._last_busy = 0;

        this._statFile = Gio.File.new_for_path('/proc/stat');
        this._icons = [];
        for ( let i = 0; i <= 100; i += 10 ) {
            this._icons.push( new St.Icon( { icon_name: 'syspeek-' + i + '-symbolic',
                                             icon_size: ICON_SIZE } ) );
        }

        this._hbox = new St.BoxLayout( { style_class: 'panel-status-menu-box' } );
        this._hbox.insert_child_at_index( this._icons[0], 0 );
        this.actor.add_child(this._hbox);

        this.menu.addAction( TEXT_SYSMON, event => {
            let appSystem = Shell.AppSystem.get_default();
            let app = appSystem.lookup_app('gnome-system-monitor.desktop');
            app.activate_full(-1, event.get_time());
        });

        this._micpu = new PopupMenu.PopupMenuItem( TEXT_CPU );
        this.menu.addMenuItem( this._micpu );

        var self = this;
        Mainloop.timeout_add_seconds( 1, function() {
            _read_stat(self);
            return enabled;
        });
    }

    _update( percentage )
    {
        if ( enabled ) {
            let icon_old = this._hbox.get_child_at_index( 0 );
            let icon_new = this._icons[ Math.trunc(percentage / 10) ];
            if ( icon_new !== icon_old ) {
                this._hbox.replace_child( icon_old, icon_new );
            }
            this._micpu.label.set_text( TEXT_CPU + percentage.toFixed(1) + '%' );
        }
    }
};

function _convert_string(line) {
    var a = line.split(' ');
    a = a.filter( function(n) { return n !== ''; } );
    a.shift();
    a.splice(7, 3);
    return a.map(Number);
}

function _read_line(dis, result)
{
    if ( enabled )
    {
        var [line, length] = dis.read_line_finish_utf8(result);
        dis.close(null);

        if (line === null) {
            return;
        }

        //global.log( TEXT_LOGID, 'Line: ' + line );
        var stats = _convert_string( line );
        var total = stats.reduce( (a, b) => a + b, 0 );
        var busy = total - stats[COL_IDLE];

        var delta_total = total - syspeek._last_total;
        var delta_busy = busy - syspeek._last_busy;

        var percentage = 0;
        if ( ( delta_total > 0 ) && ( delta_busy > 0 ) ) {
            percentage = (delta_busy / delta_total) * 100;
        }

        syspeek._update(percentage);

        syspeek._last_total = total;
        syspeek._last_busy = busy;
    }
}

function _read_stat(self)
{
    if ( enabled )
    {
        try {
            var dis = Gio.DataInputStream.new( self._statFile.read(null) );
            dis.read_line_async( GLib.PRIORITY_DEFAULT, null, _read_line );
        } catch (e) {
            global.log( TEXT_LOGID, 'Error: ' + e.message );
        }
    }
}

function enable() {
    enabled = true;
    syspeek = new SysPeekGS;
    Main.panel.addToStatusArea( TEXT_SYSPEEK, syspeek );
}

function disable() {
    enabled = false;
    syspeek.destroy();
}
