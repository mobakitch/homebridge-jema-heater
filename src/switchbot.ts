 const axios = require('axios').default;

export default class Switchbot {

  private readonly options: any;
  private timer: any;
  private _temperature: number;

  constructor(options: any) {
    this.options = options;
    this._temperature = 20.0;

    axios.defaults.baseURL = 'https://api.switch-bot.com';
    axios.defaults.headers.common['Authorization'] = options.token;
  }

  public start(): void {
    this.timer = setInterval(async () => {
      const result = await axios.get(`/v1.0/devices/${this.options.deviceId}/status`);
      const data: any = result.data;
      this._temperature = data.body.temperature;
    }, this.options.duration);
  }

  public stop(): void {
    clearInterval(this.timer);
  }

  get temperature(): number {
    return this._temperature;
  }

}
