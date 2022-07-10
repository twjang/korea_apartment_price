

export const MyTest = () =>{
    const numLine = 10;
    const x = new Float32Array(numLine);
    const y = new Float32Array(numLine);

const numAngleSplit = 7;
const lineSegLen = new Float32Array(numLine);
const lineSegTan = new Float32Array(numLine);
const lineCumTan = new Float32Array(numLine * numAngleSplit);
const angleSplit = 90 / (numAngleSplit - 1);
const tanVals = new Float32Array(numAngleSplit);
for (let i=0; i < numAngleSplit; i++)
    tanVals[i] = Math.tan(angleSplit * (i + 0.5) * Math.PI / 180.0);

for (let i=0; i<numLine; i++) {
    let dx = x[i+1] - x[i];
    let dy = y[i+1] - y[i];
    lineSegLen[i] = Math.sqrt(dx * dx + dy * dy);
    for (let j=0; j<numAngleSplit; j++)
    {
        lineSegTan[i] = j;
        if (Math.abs(dy) < Math.abs(dx * tanVals[j])) 
            break;
    }
    for (let j=0; j<numAngleSplit; j++){
        const curIdx = i + j * numLine;
        const prevLen = (i > 0)? lineCumTan[curIdx-1]: 0;
        const curLen = (j === lineSegTan[i])? lineSegLen[i]: 0;
        lineCumTan[curIdx] = prevLen + curLen;
    }
}

}