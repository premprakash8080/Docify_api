function isTimeInRange(start_time, end_time, range_start = "08:00", range_end = "15:00") {
    const toMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
    };

    const start = toMinutes(start_time);
    const end = toMinutes(end_time);
    const rangeStart = toMinutes(range_start);
    const rangeEnd = toMinutes(range_end);

    return start >= rangeStart && end <= rangeEnd;
}

function isTimeIn(start_time, range_end) {
    const toMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
    };

    const start = toMinutes(start_time);

    const rangeStart = toMinutes(range_end);
    return start < rangeStart;
}

function isTimeInOrEqual(start_time, range_end) {
    const toMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
    };

    const start = toMinutes(start_time);

    const rangeStart = toMinutes(range_end);
    return start <= rangeStart;
}

function toMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
};


  function isValidTimeRange(start_time, end_time) {
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };

    let start = timeToMinutes(end_time);
    let endMin = timeToMinutes(end_time);

    return timeToMinutes(end_time) > timeToMinutes(start_time);
  }
module.exports = {
    isTimeInRange,
    isTimeIn,
    isValidTimeRange
} 