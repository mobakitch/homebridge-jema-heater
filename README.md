# homebridge-jema-terminal

Heater accessory plugin using JEMA terminal (JEM-A 1427) and Switchbot Meter API for [Homebridge](https://github.com/homebridge/homebridge)

## Configuration

Example configuration:

```json
"accessories": [
   {
      "accessory": "JEMATerminal",
      "name": "Floor heater",
      "options": {
         "monitor": {
            "pin": 23,
            "inverted": true
         },
         "control": {
            "pin": 24,
            "duration": 1000
         },
         "switchbot": {
            "token": "your token here",
            "deviceId": "your device id here",
            "duration": 1000
         }
      }
   }
]
```
