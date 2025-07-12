/**
 * 
 * @license MIT 
 * @copyright (c) 2025 Julian Maza - ITIX

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

module.exports = function (RED) {
  function TonAlarmNode(config) {
    RED.nodes.createNode(this, config);

    var node = this;
    node.payload = null;
    node.isAlarmL = null;
    node.isAlarmH = null;
    node.isAlarmTriggered = false;
    node.isRepeating = null;
    node.lastValue = null;
    node.disabled = false;
    let parsedMinValue =
      typeof config.minValue === "boolean"
        ? config.minValue
          ? 1
          : 0
        : parseFloat(config.minValue);
    node.minValue = isNaN(parsedMinValue) ? null : parsedMinValue;
    let parsedMaxValue =
      typeof config.maxValue === "boolean"
        ? config.maxValue
          ? 1
          : 0
        : parseFloat(config.maxValue);
    node.maxValue = isNaN(parsedMaxValue) ? null : parsedMaxValue;
    let parsedTimeout = parseFloat(config.timeout);
    node.timeout = isNaN(parsedTimeout) ? null : parsedTimeout;
    let parsedRepeat = parseFloat(config.repeat);
    node.repeat = isNaN(parsedRepeat) ? null : parsedRepeat;

    node.timerId = null;
    node.timer2Id = null;

    // updateStatus()

    // this.status({fill:"blue",shape:"ring",text:"bbb"});

    //#region Alarm calculations

    /**
     * Checks for instant alarm condition
     * @param {number} value - value to be monitored
     * @returns boolean with instant alarm condition for given value
     */
    function isAlarm(value) {
      const { minValue, maxValue, disabled } = node;
      var isAlarmL =
        (typeof minValue === "number" && value < minValue && !disabled) ||
        false;
      var isAlarmH =
        (typeof maxValue === "number" && value > maxValue && !disabled) ||
        false;

      return isAlarmL || isAlarmH;
    }

    /**
     * Updates values of alarmL, alarmH and alarm on object
     */
    function updateAlarms() {
      const { minValue, maxValue, lastValue, isAlarmTriggered } = node;

      const isMinValid = typeof minValue === "number";
      const isMaxValid = typeof maxValue === "number";

      node.isAlarmL =
        isMinValid &&
        lastValue < minValue &&
        isAlarmTriggered &&
        !node.disabled;
      node.isAlarmH =
        isMaxValid &&
        lastValue > maxValue &&
        isAlarmTriggered &&
        !node.disabled;

      node.alarm = node.isAlarmL || node.isAlarmH;
    }
    //#endregion

    //#region Send message to flow

    /**
     * Publish nodered message with current status of variables
     *
     * If a syncSend function is provided, it will be used to send the message in
     *   a synced way, keeping the incoming msg id and all the stuff.
     *
     * Otherwise, the node.send function will be used (async sending)
     * @param {Function} syncSend - method provided by nodered to send messages to the current flow
     */
    function sendMsg(syncSend = null) {
      updateAlarms();

      node.isCondition = isAlarm(node.lastValue);
      let msg = {
        payload: node.isAlarmTriggered,
        isDisabled: node.disabled,
        isCondition: node.isCondition,
        isAlarmL: node.isAlarmL,
        isAlarmH: node.isAlarmH,
        isSyncMsg: syncSend != null,
        isRepeating: node.isRepeating,
        lastValue: node.lastValue,
        minValue: node.minValue,
        maxValue: node.maxValue,
        timeout: node.timeout,
        repeat: node.repeat,
        timerId: node.timerId,
        timer2Id: node.timer2Id,
      };

      if (node.disabled) {
        node.send([msg, msg]);
      } else if (syncSend != null)
        syncSend([msg, null]); // Synchronous on 1st output
      else node.send([null, msg]); // Asynchronous on 2nd output
    }
    //#endregion

    //#region First Timer

    /**
     * Callback function on first timer
     *
     * It is called once when the alarm condition is met
     * and the configured time is get.
     *
     * This function does:
     * - start of repeating timer
     * - send async message (will have isRepeating = false)
     * - update node status on screen with a red ring
     */
    function onTimer() {
      resetTimer();
      node.isAlarmTriggered = true;
      startRepeatTimer();
      sendMsg();
      updateStatus();
    }

    function startTimer() {
      // Do not start it twice
      if (node.timerId != null) {
        return;
      }
      var timerDuration = node.timeout || 60;
      node.timerId = setTimeout(onTimer, timerDuration * 1000);
      updateStatus();
    }

    function resetTimer() {
      clearTimeout(node.timerId);
      node.timerId = null;
    }
    //#endregion

    //#region Repeating Timer

    /**
     * Callback function on repeating timer
     *
     * It is called when the alarm condition is met on a repeating basis
     * and the configured repeating time is get.
     *
     * This function does:
     * - set node.isRepeating to true
     * - send async message (will have isRepeating = true)
     * - update node status on screen with a red dot
     */
    function onRepeat() {
      node.isRepeating = true;
      sendMsg();
      updateStatus();
    }

    function startRepeatTimer() {
      // Do not start it twice
      if (node.timer2Id != null) return;
      if (node.repeat == null || isNaN(node.repeat) || node.repeat == 0) return;

      node.timer2Id = setInterval(onRepeat, node.repeat * 1000);
    }

    function resetRepeatTimer() {
      node.isRepeating = false;
      clearInterval(node.timer2Id);
      node.timer2Id = null;
    }
    //#endregion

    //#region Parse incoming messages

    /**
     * Parses the content of the message and updates the object status.
     *
     * The message may have these components:
     * - payload (string) == "reset" : resets both timers and clears status
     * - payload (boolean) : received value to be checked against alarm condition.
     *        Will be translated to true=>1, false=>0
     * - payload (float) : received numeric value to be checked against alarm condition
     * - disable (boolean) : alarm system is disabled and no alarm will be triggered
     * - minValue (number) : minimum value for monitoring
     * - maxValue (number) : maximum value for monitoring
     * - timeout (number) : seconds to wait for alarm condition to be true
     * - repeat (number) : seconds to wait for alarm condition to be repeated after first timeout has elapsed
     *
     * If any component is null or invalid, it will be ignored
     *
     * @param {object} msg - message received from nodered flow
     * @returns true if msg has to be forwarded (payload present) or nothing if no payload received
     *
     */
    function parseMsg(msg) {
      if (msg.disabled != null) {
        node.disabled = msg.disable == true || msg.disabled == true;
        updateStatus();
      }

      if (node.disabled) {
        node.isAlarmTriggered = false;
        resetTimer();
        resetRepeatTimer();
        updateStatus();
        node.lastValue = null;
        node.isCondition = false;
        return true;
      }

      if (msg.payload == "reset") {
        node.isAlarmTriggered = false;
        resetTimer();
        resetRepeatTimer();
        updateStatus();
        return;
      }

      if (msg.minValue != null) {
        let parsedMin = parseFloat(msg.minValue);
        node.minValue = isNaN(parsedMin) ? null : parsedMin;
      }
      if (msg.maxValue != null) {
        let parsedMax = parseFloat(msg.maxValue);
        node.maxValue = isNaN(parsedMax) ? null : parsedMax;
      }

      if (msg.timeout != null) {
        let tmp = parseInt(msg.timeout);

        if (tmp != null && !isNaN(tmp) && node.lastTimeout != tmp) {
          node.timeout = tmp;

          // Restart timer if it was running
          let running = node.timerId != null;
          resetTimer();
          if (running) {
            startTimer();
          }
        }
      }

      if (msg.repeat != null) {
        let tmp = parseInt(msg.repeat);

        if (tmp != null && !isNaN(tmp) && node.lastRepeat != tmp) {
          node.repeat = tmp;

          // Restart repeat timer if it was running
          let running = node.timer2Id != null;
          resetRepeatTimer();
          if (running) {
            startRepeatTimer();
          }
        }
      }

      // Payload of the main variable
      var txt = String(msg.payload)
        .replace(/^"(.*)"$/, "$1")
        .trim();
      var value =
        typeof msg.payload === "boolean"
          ? msg.payload
            ? 1
            : 0
          : parseFloat(txt);

      if (!Number.isNaN(value)) {
        node.lastValue = value;
        node.isCondition = isAlarm(value);
        updateAlarms();

        if (node.isCondition) {
          if (node.timerId == null && node.timer2Id == null) {
            startTimer();
          }
        } else {
          resetTimer();
          resetRepeatTimer();
          node.isAlarmTriggered = false;
          updateStatus();
        }
        return true;
      }
    }

    //#endregion

    function updateStatus() {
      if (node.disabled) {
        node.status({ fill: "gray", shape: "dot", text: "disabled" });
      } else if (node.isAlarmTriggered) {
        if (node.isRepeating) {
          node.status({ fill: "red", shape: "dot", text: "alarm repeating" });
        } else {
          node.status({ fill: "red", shape: "ring", text: "alarm active" });
        }
      } else {
        if (node.isCondition) {
          node.status({
            fill: "yellow",
            shape: "ring",
            text: "alarm condition",
          });
        } else {
          node.status({});
        }
      }
    }

    this.on("input", function (msg, send, done) {
      node.context().set("msg", msg);
      if (parseMsg(msg)) {
        sendMsg(send);
      }
      done();
    });
    this.on("close", function (removed, done) {
      resetTimer();
      resetRepeatTimer();
      updateStatus();
      done();
    });
  }

  RED.nodes.registerType("ton-alarm", TonAlarmNode);
};
