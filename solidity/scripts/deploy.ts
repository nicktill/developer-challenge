import { ethers } from "hardhat";

async function main() {
  const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
  const simpleStorage = await SimpleStorage.deploy();
  await simpleStorage.deployed();

  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.deployed();

  
  // Deploy AssetLibrary contract
  const AssetLibrary = await ethers.getContractFactory("AssetLibrary");
  const assetLibrary = await AssetLibrary.deploy();
  await assetLibrary.deployed();
  

  console.log("Contracts deployed!\nAdd the addresses to backend/config.json:");
  console.log(`SIMPLE_STORAGE_ADDRESS: ${simpleStorage.address}`);
  console.log(`TOKEN_ADDRESS: ${token.address}`);
  console.log(`ASSET_LIBRARY_ADDRESS: ${assetLibrary.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
