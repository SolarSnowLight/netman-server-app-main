module.exports = function (sequelize, DataTypes) {
    return sequelize.define('register_commands', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        }
    });
};