module.exports = function (sequelize, DataTypes) {
    return sequelize.define('marks', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        lat: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        lng: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        location: {
            type: DataTypes.STRING(1024),
            allowNull: false
        }
    });
};