/* global imports */

const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();

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

        let statFile = Gio.File.new_for_path('/proc/stat');
        this._input = Gio.DataInputStream.new( statFile.read(null) );

        this._icons = [];
        for ( let i = 0; i <= 100; i += 10 ) {
            let gicon = Gio.icon_new_for_string( Me.path + '/icons/syspeek-' + i + '.svg' );
            this._icons.push( new St.Icon( { gicon: gicon, icon_size: ICON_SIZE } ) );
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

        Mainloop.timeout_add_seconds( 1, Lang.bind( this, function() {
            this._read_stat();
            return enabled;
        } ));
    }

    destroy() {
        this._input.close(null);
        super.destroy();
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

    _convert_string(line) {
        var a = line.split(' ');
        a = a.filter( function(n) { return n !== ''; } );
        a.shift();
        a.splice(7, 3);
        return a.map(Number);
    }

    _read_stat()
    {
        if ( enabled )
        {
            this._input.seek( 0, GLib.SeekType.SET, null );
            var [line, length] = this._input.read_line_utf8(null);

            if (line === null) {
                return;
            }

            //global.log( TEXT_LOGID, 'Line: ' + line );
            var stats = this._convert_string( line );
            var total = stats.reduce( (a, b) => a + b, 0 );
            var busy = total - stats[ COL_IDLE ];

            var delta_total = total - this._last_total;
            var delta_busy = busy - this._last_busy;

            var percentage = 0;
            if ( ( delta_total > 0 ) && ( delta_busy > 0 ) ) {
                percentage = (delta_busy / delta_total) * 100;
            }

            this._update(percentage);

            this._last_total = total;
            this._last_busy = busy;
        }
    }
};


function enable() {
    enabled = true;
    syspeek = new SysPeekGS;
    Main.panel.addToStatusArea( TEXT_SYSPEEK, syspeek );
}

function disable() {
    enabled = false;
    syspeek.destroy();
}
