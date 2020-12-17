const ClearingHouse = artifacts.require('ClearingHouse');

const OWNER = '0x57D401B8502bC5CBBaAfD2564236dE4571165051';

module.exports = async (deployer) => {
  await deployer.deploy(ClearingHouse, OWNER);
};
