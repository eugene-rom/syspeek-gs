/* global imports */

import GLib from 'gi://GLib'
import Gio from 'gi://Gio'
import GObject from 'gi://GObject'
import St from 'gi://St'
import Shell from 'gi://Shell'

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Panel from 'resource:///org/gnome/shell/ui/panel.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const ICON_SIZE    = 26;
const COL_IDLE     = 3;
const TEXT_SYSPEEK = 'SysPeek';
const TEXT_SYSMON  = 'System Monitor...';
const TEXT_CPU     = 'CPU: ';
const TEXT_LOGID   = 'syspeek-gs';

let sourceId = null;

class SysPeekGSBtn extends PanelMenu.Button
{
    static {
        GObject.registerClass(this);
    }

    constructor( path )
    {
        super( 0.0, TEXT_SYSPEEK );

        this._last_total = 0;
        this._last_busy = 0;

        let statFile = Gio.File.new_for_path('/proc/stat');
        this._input = Gio.DataInputStream.new( statFile.read(null) );

        this._icons = [];
        for ( let i = 0; i <= 100; i += 10 ) {
            let gicon = Gio.icon_new_for_string( path + '/icons/syspeek-' + i + '.svg' );
            this._icons.push( new St.Icon( { gicon: gicon, icon_size: ICON_SIZE } ) );
        }

        this._hbox = new St.BoxLayout( { style_class: 'panel-status-menu-box' } );
        this._hbox.insert_child_at_index( this._icons[0], 0 );
        this.add_child(this._hbox);

        this.menu.addAction( TEXT_SYSMON, event => {
            let appSystem = Shell.AppSystem.get_default();
            let app = appSystem.lookup_app('gnome-system-monitor.desktop');
            app = app || appSystem.lookup_app('org.gnome.SystemMonitor.desktop');
            if ( app !== null ) {
                app.activate_full(-1, event.get_time());
            }
        });

        this._micpu = new PopupMenu.PopupMenuItem( TEXT_CPU );
        this.menu.addMenuItem( this._micpu );

        sourceId = GLib.timeout_add_seconds( GLib.PRIORITY_DEFAULT, 1, this._read_stat.bind(this) );
    }

    destroy() {
        this._input.close(null);
        super.destroy();
    }

    _update( percentage )
    {
        let icon_old = this._hbox.get_child_at_index( 0 );
        let icon_new = this._icons[ Math.trunc(percentage / 10) ];
        if ( icon_new !== icon_old ) {
            this._hbox.replace_child( icon_old, icon_new );
        }
        this._micpu.label.set_text( TEXT_CPU + percentage.toFixed(1) + '%' );
    }

    _convert_string( line )
    {
        let a = line.split(' ');
        a = a.filter( n => { return n !== ''; } );
        a.shift();
        a.splice(7, 3);
        return a.map(Number);
    }

    _read_stat()
    {
        this._input.seek( 0, GLib.SeekType.SET, null );
        let [line, length] = this._input.read_line_utf8(null);

        if (line === null) {
            return;
        }

        //global.log( TEXT_LOGID, 'Line: ' + line );
        let stats = this._convert_string( line );
        let total = stats.reduce( (a, b) => a + b, 0 );
        let busy = total - stats[ COL_IDLE ];

        let delta_total = total - this._last_total;
        let delta_busy = busy - this._last_busy;

        let percentage = 0;
        if ( ( delta_total > 0 ) && ( delta_busy > 0 ) ) {
            percentage = (delta_busy / delta_total) * 100;
        }

        this._update(percentage);

        this._last_total = total;
        this._last_busy = busy;

        return true;
    }
}

export default class SysPeekGS extends Extension
{
    enable() {
        this._syspeek = new SysPeekGSBtn( this.path );
        Main.panel.addToStatusArea( TEXT_SYSPEEK, this._syspeek );
    }

    disable()
    {
        if ( sourceId ) {
            GLib.Source.remove( sourceId );
            sourceId = null;
        }

        this._syspeek.destroy();
        this._syspeek = null;
    }
}

