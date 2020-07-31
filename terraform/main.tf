provider "google-beta" {
  region  = "us-central1"
}

provider "google" {
  region  = "us-central1"
}

module "testing_tables" {
  source = "./modules/network_tables"
  network = "testing"
}

module "baklava_tables" {
  source = "./modules/network_tables"
  network = "baklava"
}

module "mainnet_tables" {
  source = "./modules/network_tables"
  network = "mainnet"
}
