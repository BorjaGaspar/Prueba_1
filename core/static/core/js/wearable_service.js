/*
 * SamiraDTx — Wearable Service (Web Bluetooth + Heart Rate Service GATT)
 *
 * API pública (window.Wearable):
 *   isSupported(), connect(), disconnect(), forget(),
 *   isConnected(), startRecording(), stopRecording(),
 *   onStatusChange(cb), getLastSampleBpm(), mountHeartIcon(opts)
 *
 * Conexión siempre manual: el paciente pulsa "Vincular Reloj" en la
 * pantalla de instrucciones de cada juego. No hay reconexión automática.
 */
(function () {
    'use strict';

    var HR_SERVICE = 'heart_rate';
    var HR_CHARACTERISTIC = 'heart_rate_measurement';

    var state = {
        device: null,
        server: null,
        characteristic: null,
        connected: false,
        recording: false,
        buffer: [],
        lastBpm: null,
        listeners: [],
    };

    function emit(status) {
        for (var i = 0; i < state.listeners.length; i++) {
            try { state.listeners[i](status); } catch (e) { /* listener silencioso */ }
        }
    }

    function parseHeartRate(dataView) {
        if (!dataView || dataView.byteLength < 2) return null;
        var flags = dataView.getUint8(0);
        var is16bit = (flags & 0x01) === 0x01;
        try {
            return is16bit ? dataView.getUint16(1, true) : dataView.getUint8(1);
        } catch (e) {
            return null;
        }
    }

    function onSample(event) {
        var bpm = parseHeartRate(event.target.value);
        if (bpm === null || bpm < 30 || bpm > 220) return;
        state.lastBpm = bpm;
        if (state.recording) state.buffer.push(bpm);
    }

    function onDisconnect() {
        state.connected = false;
        state.characteristic = null;
        state.server = null;
        emit('disconnected');
    }

    function attachDeviceHandlers(device) {
        device.removeEventListener('gattserverdisconnected', onDisconnect);
        device.addEventListener('gattserverdisconnected', onDisconnect);
    }

    async function bindCharacteristic(device) {
        console.log('[Wearable] Conectando GATT a:', device.name);
        var server = await device.gatt.connect();
        var service = await server.getPrimaryService(HR_SERVICE);
        var characteristic = await service.getCharacteristic(HR_CHARACTERISTIC);
        characteristic.removeEventListener('characteristicvaluechanged', onSample);
        characteristic.addEventListener('characteristicvaluechanged', onSample);
        await characteristic.startNotifications();
        state.device = device;
        state.server = server;
        state.characteristic = characteristic;
        state.connected = true;
        attachDeviceHandlers(device);
        emit('connected');
        console.log('[Wearable] Estado: CONECTADO.');
        return true;
    }

    function isSupported() {
        return typeof navigator !== 'undefined' && !!navigator.bluetooth;
    }

    async function connect() {
        if (!isSupported()) return false;
        try {
            console.log('[Wearable] Abriendo selector BLE...');
            var device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [HR_SERVICE] }],
                optionalServices: ['battery_service'],
            });
            console.log('[Wearable] Dispositivo seleccionado:', device.name);
            await bindCharacteristic(device);
            return true;
        } catch (e) {
            console.warn('[Wearable] Error o usuario canceló:', e.message || e);
            return false;
        }
    }

    function disconnect() {
        try {
            if (state.characteristic) {
                state.characteristic.removeEventListener('characteristicvaluechanged', onSample);
            }
            if (state.server && state.server.connected) {
                state.server.disconnect();
            }
        } catch (e) { /* noop */ }
        state.connected = false;
        state.characteristic = null;
        state.server = null;
        emit('disconnected');
    }

    function forget() {
        disconnect();
        state.device = null;
    }

    function isConnected() {
        return state.connected === true;
    }

    function startRecording() {
        state.buffer = [];
        state.recording = true;
    }

    function stopRecording() {
        state.recording = false;
        if (state.buffer.length < 3) return null;
        var serie = state.buffer.slice();
        var sum = 0, minV = serie[0], maxV = serie[0];
        for (var i = 0; i < serie.length; i++) {
            sum += serie[i];
            if (serie[i] < minV) minV = serie[i];
            if (serie[i] > maxV) maxV = serie[i];
        }
        return {
            fc_min: minV,
            fc_max: maxV,
            fc_avg: Math.round(sum / serie.length),
            fc_serie: serie,
        };
    }

    function onStatusChange(callback) {
        if (typeof callback !== 'function') return;
        state.listeners.push(callback);
    }

    function getLastSampleBpm() {
        return state.lastBpm;
    }

    /* ---------- UI: icono de corazón fijo en esquina (visible durante el juego) ---------- */

    var HEART_STYLE_ID = 'wearable-heart-style';
    var _heartMounted = false;

    function injectHeartStyles() {
        if (document.getElementById(HEART_STYLE_ID)) return;
        var css = ''
            + '.wearable-heart{position:fixed;top:18px;right:18px;z-index:1040;'
            + 'width:42px;height:42px;border-radius:50%;display:flex;'
            + 'align-items:center;justify-content:center;background:#ffffff;'
            + 'border:1.5px solid #e4e7ec;color:#98a2b3;font-size:1.05rem;'
            + 'box-shadow:0 1px 2px rgba(16,24,40,.05);'
            + 'transition:color 180ms ease-out,border-color 180ms ease-out;'
            + 'pointer-events:none;user-select:none;will-change:transform}'
            + '.wearable-heart[data-status="connected"]{color:#d92d20;border-color:#fecdca}'
            + '.wearable-heart[data-status="connected"] .wearable-heart-glyph{'
            + 'animation:wearable-heart-beat 1s cubic-bezier(0.16,1,0.3,1) infinite;'
            + 'display:inline-block;transform-origin:center}'
            + '@keyframes wearable-heart-beat{'
            + '0%,60%,100%{transform:scale(1)}'
            + '15%{transform:scale(1.22)}'
            + '30%{transform:scale(1)}'
            + '45%{transform:scale(1.12)}}'
            + '@media (prefers-reduced-motion:reduce){'
            + '.wearable-heart[data-status="connected"] .wearable-heart-glyph{animation:none}}';
        var el = document.createElement('style');
        el.id = HEART_STYLE_ID;
        el.textContent = css;
        document.head.appendChild(el);
    }

    function mountHeartIcon(opts) {
        if (!isSupported()) return null;
        if (_heartMounted) return document.querySelector('.wearable-heart');
        opts = opts || {};
        injectHeartStyles();

        var host = document.createElement('div');
        host.className = 'wearable-heart';
        host.setAttribute('aria-hidden', 'true');
        host.innerHTML = '<i class="bi bi-heart-fill wearable-heart-glyph"></i>';

        if (opts.position === 'top-left') {
            host.style.left = '18px'; host.style.right = 'auto';
        } else if (opts.position === 'bottom-right') {
            host.style.top = 'auto'; host.style.bottom = '18px';
        } else if (opts.position === 'bottom-left') {
            host.style.top = 'auto'; host.style.bottom = '18px';
            host.style.left = '18px'; host.style.right = 'auto';
        }

        function paint(connected) {
            if (connected) host.setAttribute('data-status', 'connected');
            else host.removeAttribute('data-status');
        }

        paint(isConnected());
        onStatusChange(function (s) { paint(s === 'connected'); });

        document.body.appendChild(host);
        _heartMounted = true;
        return host;
    }

    window.Wearable = {
        isSupported: isSupported,
        connect: connect,
        disconnect: disconnect,
        forget: forget,
        isConnected: isConnected,
        startRecording: startRecording,
        stopRecording: stopRecording,
        onStatusChange: onStatusChange,
        getLastSampleBpm: getLastSampleBpm,
        mountHeartIcon: mountHeartIcon,
    };
})();
