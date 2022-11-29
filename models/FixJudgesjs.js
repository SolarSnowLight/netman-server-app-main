module.exports = function (sequelize, DataTypes) {
    return sequelize.define('fix_judges', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        }
    });
};