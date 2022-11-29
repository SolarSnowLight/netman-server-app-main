module.exports = function (sequelize, DataTypes) {
    return sequelize.define('marks', {
        lat: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            primaryKey: true
        },
        lng: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            primaryKey: true
        },
        location: {
            type: DataTypes.STRING(1024),
            allowNull: false
        }
    });
};