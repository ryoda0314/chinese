// Hands each block of microphone samples to the page (src/components/recorder.ts).
class KotonootoRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("kotonooto-recorder", KotonootoRecorder);
