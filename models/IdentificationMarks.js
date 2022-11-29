module.exports = function (sequelize, DataTypes) {
    return sequelize.define('identification_marks', {
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
            type: DataTypes.STRING,
            allowNull: false
        },
        radius: {
            type: DataTypes.DOUBLE,
            allowNull: false
        },
        ref_image: {
            type: DataTypes.STRING,
            allowNull: false
        },
        date_create: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });
};