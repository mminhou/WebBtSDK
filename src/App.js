import React, {useState, useEffect} from 'react';
import './App.css';
import fabric from 'fabric'

export default function App() {
    const [supportsBluetooth, setSupportsBluetooth] = useState(false);
    const [isDisconnected, setIsDisconnected] = useState(true);
    const [batteryLevel, setBatteryLevel] = useState(null);

    // When the component mounts, check that the browser supports Bluetooth
    useEffect(() => {
        if (navigator.bluetooth) {
            setSupportsBluetooth(true);
        }
    }, []);

    /**
     * Let the user know when their device has been disconnected.
     */
    const onDisconnected = (event) => {
        alert(`The device ${event.target} is disconnected`);
        setIsDisconnected(true);
    }

    /**
     * Calculate value position
     */
    const calVal = (p, fp) => {
        return p + fp/100
    }

    /**
     * Handle event -
     */
    const handleCharacteristicVersionValue = (event) => {
        const data = event.target.value;
        const buff = new Uint8Array(data.buffer);
        // console.log(buff)

        // Define canvas, ctx
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');

        const canvasfb = new fabric.Canvas('c2');
        console.log(canvasfb)


        var rect = new fabric.Rect({
          left: 100,
          top: 100,
          fill: 'red',
          width: 20,
          height: 20
        });

        // "add" rectangle onto canvas
        canvasfb.add(rect);




        // 흠..... 왜 안되누
        if (buff[1] == 129) {
            console.log('version packet success!');
            return
        } else if (buff[1] === 132) {
            console.log('pen info success!');
            console.log(buff)
            console.log(buff[26], 'battery level');
            setBatteryLevel(buff[26]);
            return
        } else if (buff[1] === 145) {
            console.log('online data request!!! ----------------------- ');
            return
        }


        // Get index of 192
        let indexesOf192 = [];
        buff.forEach(function(elem, index, array) {
            if (elem === 192) {indexesOf192.push(index)}
            return indexesOf192
        })

        // 105, 106, 108 패킷 처리담당 로직 -> canvas draw
        for (let i=0; i<indexesOf192.length-1; i++) {
            const tmp = buff.slice(indexesOf192[i], indexesOf192[i+1]);
            console.log(tmp)
            if (tmp[1] === 105) {
                console.log('PenDown');
                ctx.beginPath();
            } else if (tmp[1] === 108) {
                // 16으로 받아오는거랑 차이가 없군
                // const xPos = new Buffer(tmp.slice(8, 10));
                // const xPos16 = new Uint16Array(xPos.buffer, xPos.byteOffset, xPos.byteLength / Uint16Array.BYTES_PER_ELEMENT);
                // const yPos = new Buffer(tmp.slice(10, 12));
                // const yPos16 = new Uint16Array(yPos.buffer, yPos.byteOffset, yPos.byteLength / Uint16Array.BYTES_PER_ELEMENT);

                // const force = new Buffer(tmp.slice(6, 8));
                // const force16 = new Uint16Array(force.buffer, force.byteOffset, force.byteLength / Uint16Array.BYTES_PER_ELEMENT);
                // console.log(force16, 'original');
                // console.log(tmp[7], 'based 16');
                const x = calVal(tmp[8], tmp[12]) * 10;
                const y = calVal(tmp[10], tmp[13]) * 10;
                if (tmp.length === 19) {
                    ctx.lineCap = 'round';
                    // based force -> 필압에 의한 lineWidth 공식이 있을까? -> 이거만 잘 바꾸면 완벽할거 같은디
                    ctx.lineWidth = tmp[7] + (tmp[6]/100);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    ctx.closePath();
                    ctx.beginPath();
                    ctx.moveTo(x,y);
                }
            } else if (tmp[1] === 106) {
                ctx.closePath();
            }
        }
    }

    /**
     * Attempts to connect to a Bluetooth device and subscribe to
     */
    const connectToDeviceAndSubscribeToUpdates = async () => {

        // Search for Bluetooth devices
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                {
                    services: ['4f99f138-9d53-5bfa-9e50-b147491afe68']
                },
                {
                    namePrefix: 'Neosmartpen_N2'
                }],
            optionalServices: [
                0x19f1
            ]
        });

        console.log('device success')
        setIsDisconnected(false);

        // Add an event listener to detect when a device disconnects
        device.addEventListener('gattserverdisconnected', onDisconnected);

        // Try to connect to the remote GATT Server running on the Bluetooth device
        const server = await device.gatt.connect();

        // Get the service from the Bluetooth device
        /*
        '8bc8cc7d-88ca-56b0-af9a-9bf514d0d61a' AppToPen /
        '64cd86b1-2256-5aeb-9f04-2caf6c60ae57' PenToApp /
        */

        const service = await server.getPrimaryService(0x19f1);

        // Get the PenToApp/AppToPen level characteristic from the Bluetooth device
        const ATPcharacteristic = await service.getCharacteristic(0x2BA0);
        const PTAcharacteristic = await service.getCharacteristic(0x2BA1);

        const START = 0xc0;
        const END = 0xc1;

        const versionPacket = new Uint8Array([
            START,
            // cmd (1)
            0x01,
            // length (2)
            0x2a, 0x00,
            // connection code (16)
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            // app type (2)
            0x00, 0x00,
            // app version (16)
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            // protocol version (8) 2.18 >> ASCII
            0x32, 0x2e, 0x32, 0x30, 0x00, 0x00, 0x00, 0x00,
            END,
        ])

        const penInfoPacket = new Uint8Array([
            START,
            // cmd (1)
            0x04,
            // length (2)
            0x00, 0x00,
            END
        ])

        const onlineDataPacket = new Uint8Array([
            START,
            // cmd (1)
            0x11,
            // length (2)
            0x02, 0x00,
            // battery (1)
            0xff, 0xff,
            END
        ])

        const hoverMode = new Uint8Array([
            START,
            //cmd (1)
            0x05,
            //length (2)
            0x02, 0x00,
            //type (1)
            0x06,
            //value (n)
            0x01,
            END
        ])

        // debugger;

        PTAcharacteristic.startNotifications();
        PTAcharacteristic.addEventListener('characteristicvaluechanged',
            handleCharacteristicVersionValue);

        await ATPcharacteristic.writeValue(versionPacket)
        await ATPcharacteristic.writeValue(penInfoPacket)
        await ATPcharacteristic.writeValue(onlineDataPacket)
        // await ATPcharacteristic.writeValue(hoverMode)
        // console.log('hover mode success!')




    };

    return (
        <div className="App">
            <h1>Get Device Info Over Bluetooth</h1>
            {supportsBluetooth && !isDisconnected &&
            <h3> level: {batteryLevel}%</h3>
            }

            {supportsBluetooth && isDisconnected &&
            <button onClick={connectToDeviceAndSubscribeToUpdates}>Connect to a Bluetooth device</button>
            }
            asdfasfsafasdfsdf
            <canvas id="c2"></canvas>
            {/*<canvas id="c" width="2000px" height='2000px'></canvas>*/}


            {/*<button onClick={handleCharacteristicPenInfoValue}>asdf</button>*/}
            {!supportsBluetooth &&
            <p>This browser doesn't support the Web Bluetooth API</p>
            }

        </div>
    );
}

