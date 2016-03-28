module.exports = {
  attributes:  function(DataTypes){
    return {
      douban_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING
      },
      douban_url: {
        type: DataTypes.STRING
      }
    }
  }
}