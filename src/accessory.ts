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

  private targetTemperature: number;
  private thresholdTemperature: number;
  private temperatureDisplayUnits: number;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.terminal = new JEMATerminal(config.options);
    this.switchbot = new Switchbot(config.options.switchbot);

    this.heaterService = new hap.Service.Thermostat(this.name);

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
        let err = undefined;
        let on: boolean = false;
        switch (value) {
        case hap.Characteristic.TargetHeatingCoolingState.OFF:
          on = false;
          break;
        case hap.Characteristic.TargetHeatingCoolingState.HEAT:
          on = true;
          break;
        default:
          err = new Error(`state ${value} not supported`);
          break;
        }
        if (!err) {
          await this.terminal.set(on);
        }
        callback(err);
      });

    // current temperature
    this.heaterService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.switchbot.temperature));

    // target temperature
    this.targetTemperature = 20.0;
    this.heaterService.getCharacteristic(hap.Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.targetTemperature))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.targetTemperature = value as number;
        callback(undefined);
      });

    // heating threshold temperature
    this.thresholdTemperature = 24.0;
    this.heaterService.getCharacteristic(hap.Characteristic.HeatingThresholdTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.thresholdTemperature))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.thresholdTemperature = value as number;
        callback(undefined);
      });

    // display units
    this.temperatureDisplayUnits = hap.Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.heaterService.getCharacteristic(hap.Characteristic.TemperatureDisplayUnits)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => callback(undefined, this.temperatureDisplayUnits))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.temperatureDisplayUnits = value as number;
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
    });

    this.terminal.on('change', (value: any) => {
      const state = hap.Characteristic.CurrentHeatingCoolingState;
      this.heaterService.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).updateValue(value ? state.HEAT : state.OFF);
    });

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

}
