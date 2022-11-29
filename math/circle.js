//**********************************************
// Модуль математических формул для окружностей
//**********************************************

// Расстояние между двумя точками
const distancePoint = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow((x1 - x2), 2)
        + Math.pow((y1 - y2), 2));
}

// Пересечение двух окружностей
const intersectionCircles = (x1, y1, x2, y2, r1, r2) => {
    return (distancePoint(x1, y1, x2, y2) < (r1 + r2));
}

// Попадание точки в окружность
const pointInCircles = (x, y, x0, y0, r) => {
    return ((Math.pow((x - x0), 2) + Math.pow((y - y0), 2)) <= Math.pow(r, 2));
}

const radiusLatLng = (radius) => {
    return (radius / 100000);
}

module.exports.distancePoint = distancePoint;
module.exports.intersectionCircles = intersectionCircles;
module.exports.pointInCircles = pointInCircles;
module.exports.radiusLatLng = radiusLatLng;