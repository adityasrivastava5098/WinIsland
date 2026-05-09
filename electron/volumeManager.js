const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CSHARP_CODE = `
using System;
using System.Runtime.InteropServices;

public class Audio {
    [ComImport]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
    }

    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate(ref Guid iid, int dwClsContext, IntPtr pActivationParams, out IAudioEndpointVolume ppInterface);
    }

    [ComImport]
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume {
        int RegisterControlChangeNotify(IntPtr pNotify);
        int UnregisterControlChangeNotify(IntPtr pNotify);
        int GetChannelCount(out uint pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        int SetMute(bool bMute, ref Guid pguidEventContext);
        int GetMute(out bool pbMute);
        int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
        int VolumeStepUp(ref Guid pguidEventContext);
        int VolumeStepDown(ref Guid pguidEventContext);
        int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    }

    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumerator { }

    public static float GetVolume() {
        try {
            IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            IMMDevice device;
            enumerator.GetDefaultAudioEndpoint(0, 1, out device);
            Guid iid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
            IAudioEndpointVolume volume;
            device.Activate(ref iid, 1, IntPtr.Zero, out volume);
            float level;
            volume.GetMasterVolumeLevelScalar(out level);
            return level * 100;
        } catch { return -1; }
    }

    public static void SetVolume(float level) {
        try {
            IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            IMMDevice device;
            enumerator.GetDefaultAudioEndpoint(0, 1, out device);
            Guid iid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
            IAudioEndpointVolume volume;
            device.Activate(ref iid, 1, IntPtr.Zero, out volume);
            Guid dummy = Guid.Empty;
            volume.SetMasterVolumeLevelScalar(level / 100, ref dummy);
        } catch { }
    }
}
`;

class VolumeManager {
  constructor() {
    this.ps = null;
    this.ready = false;
    this.pendingCallbacks = [];
    this._init();
  }

  _init() {
    this.ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-']);
    
    this.ps.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output.startsWith('READY')) {
        this.ready = true;
        this._flushPending();
      } else if (output.startsWith('VOL:')) {
        const vol = parseFloat(output.substring(4));
        const callback = this.pendingCallbacks.shift();
        if (callback) callback(vol);
      }
    });

    this.ps.stderr.on('data', (data) => {
      console.error(`[VolumeManager] PS Error: ${data.toString()}`);
    });

    // Inject C# code
    this.ps.stdin.write(`Add-Type -TypeDefinition @'\n${CSHARP_CODE}\n'@\n`);
    this.ps.stdin.write(`Write-Output "READY"\n`);
  }

  _flushPending() {
    while (this.pendingCallbacks.length > 0 && this.ready) {
      this.ps.stdin.write(`Write-Output "VOL:$([Audio]::GetVolume())"\n`);
    }
  }

  getVolume(callback) {
    if (!this.ready) {
      this.pendingCallbacks.push(callback);
      return;
    }
    
    this.pendingCallbacks.push(callback);
    this.ps.stdin.write(`Write-Output "VOL:$([Audio]::GetVolume())"\n`);
  }

  setVolume(level) {
    if (!this.ready) return;
    this.ps.stdin.write(`[Audio]::SetVolume(${level})\n`);
  }

  dispose() {
    if (this.ps) {
      this.ps.stdin.write('exit\n');
      this.ps.kill();
    }
  }
}

module.exports = VolumeManager;
