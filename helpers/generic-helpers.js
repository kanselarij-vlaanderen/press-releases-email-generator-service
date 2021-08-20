export function handleGenericError(e, next) {
    console.error(e);
    e.status = 500;
    return next(e);
}

export function mapBindingValue(binding) {
    const result = {};
    for (let key in binding) {
        result[key] = binding[key].value;
    }
    return result;
}

export function splitArrayIntoBatches(input, batchSize) {
    return input.reduce((resultArray, item, index) => {

        const chunkIndex = Math.floor(index / batchSize);

        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = []; // start a new chunk
        }

        resultArray[chunkIndex].push(item);

        return resultArray;
    }, []);
}
