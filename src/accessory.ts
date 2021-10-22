import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";
import JEMATerminal from "rpi-jema-terminal";
import path from "path";
import fs from "fs";
import os from "os";
import _ from "lodash";
import Switchbot from "./switchbot";

let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("JEMAHeater", JEMAHeaterAccessory);
};

class JEMAHeaterAccessory implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;

  private readonly heaterService: Service;
  private readonly informationService: Service;

  private readonly terminal: JEMATerminal;
  private readonly switchbot: Switchbot;

  private userdata: any;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.terminal = new JEMATerminal(config.options);
    this.switchbot = new Switchbot(config.options.switchbot);

    this.heaterService = new hap.Service.Thermostat(this.name);

    const tmpdir = path.join(os.tmpdir(), config.name);
    fs.mkdirSync(tmpdir, {recursive: true});
    const tmpfile = path.join(tmpdir, 'user.json');
    this.userdata = {};
    if (fs.existsSync(tmpfile)) {
      this.userdata = JSON.parse(fs.readFileSync(tmpfile, 'utf8'));
    }
    _.defaults(this.userdata, {
      targetTemperature: 20.0,
      temperatureDisplayUnits: hap.Characteristic.TemperatureDisplayUnits.CELSIUS
    });
    this.userdata.thresholdTemperature =  config.options.thresholdTemperature;
    log.info(this.userdata);
  
    // current state
    this.heaterService.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        const state = hap.Characteristic.CurrentHeatingCoolingState;
        callback(undefined, this.terminal.value ? state.HEAT : state.OFF);
      });

    // target state
    this.heaterService.getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        const state = hap.Characteristic.TargetHeatingCoolingState;
        callback(undefined, this.terminal.value ? state.HEAT : state.OFF);
      })
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        let on: boolean = false;
        switch (value) {
        case hap.Characteristic.TargetHeatingCoolingState.OFF:
          on = false;
          break;
        case hap.Characteristic.TargetHeatingCoolingState.HEAT:
        case hap.Characteristic.TargetHeatingCoolingState.AUTO:
          on = true;
          break;
        default:
          log.warn(`state ${value} not supported`);
          break;
        }
        await this.terminal.set(on);
        callback(undefined);
      });

    // current temperature
    this.heaterService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.switchbot.temperature));

    // target temperature
    this.heaterService.getCharacteristic(hap.Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.userdata.targetTemperature))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.userdata.targetTemperature = value as number;
        this.updateHeaterState(this.switchbot.temperature);
        callback(undefined);
      });

    // heating threshold temperature
    this.heaterService.getCharacteristic(hap.Characteristic.HeatingThresholdTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.userdata.thresholdTemperature))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.userdata.thresholdTemperature = value as number;
        this.updateHeaterState(this.switchbot.temperature);
        callback(undefined);
      });

    // display units
    this.heaterService.getCharacteristic(hap.Characteristic.TemperatureDisplayUnits)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.userdata.temperatureDisplayUnits))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.userdata.temperatureDisplayUnits = value as number;
        callback(undefined);
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Kawabata Farm")
      .setCharacteristic(hap.Characteristic.Model, "JEM-A Heater");

    api.on('didFinishLaunching', () => {
      this.terminal.setup();
      this.switchbot.start();
    }).on('shutdown', () => {
      this.switchbot.stop();
      fs.writeFileSync(tmpfile, JSON.stringify(this.userdata));
    });

    this.terminal.on('change', (value: any) => {
      const state = hap.Characteristic.CurrentHeatingCoolingState;
      this.heaterService.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).updateValue(value ? state.HEAT : state.OFF);
    });

    this.switchbot.on('change', (temperature) => this.updateHeaterState(temperature));

    log.info("JEM-A Terminal finished initializing!");
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.heaterService
    ];
  }

  private async updateHeaterState(currentTemperature: number) {
    const state = hap.Characteristic.CurrentHeatingCoolingState;

    if (currentTemperature < this.userdata.targetTemperature && this.terminal.value == false) {
      await this.terminal.set(true);
      this.heaterService.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).updateValue(state.HEAT);
    }
    if (currentTemperature > this.userdata.thresholdTemperature && this.terminal.value == true){
      await this.terminal.set(false);
      this.heaterService.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).updateValue(state.OFF);
    }
  }

}
