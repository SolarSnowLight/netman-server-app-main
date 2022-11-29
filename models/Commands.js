module.exports = function (sequelize, DataTypes) {
    return sequelize.define('commands', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        date_register: {
            type: DataTypes.DATE,
            allowNull: false
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });
};