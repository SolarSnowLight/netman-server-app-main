module.exports = function (sequelize, DataTypes) {
    return sequelize.define('judge_scores', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        score: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });
};