import { EventEmitter } from "events";

const axios = require('axios').default;

export default class Switchbot extends EventEmitter {

  private readonly options: any;
  private timer: any;
  private _temperature: number;

  constructor(options: any) {
    super();

    this.options = options;
    this._temperature = 20.0;

    axios.defaults.baseURL = 'https://api.switch-bot.com';
    axios.defaults.headers.common['Authorization'] = options.token;
  }

  public start(): void {
    this.updateTemperature();
    this.timer = setInterval(() => this.updateTemperature(), this.options.duration);
  }

  public stop(): void {
    clearInterval(this.timer);
  }

  get temperature(): number {
    return this._temperature;
  }

  private async updateTemperature() {
    const result = await axios.get(`/v1.0/devices/${this.options.deviceId}/status`);
    const data: any = result.data;
    if (this._temperature = data.body.temperature) {
      this.emit('change', this._temperature);
    }
    this._temperature = data.body.temperature;
  }

}
