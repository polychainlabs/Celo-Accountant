GCP_PROJECT=your-project-id
REGION=us-central1

%baklava: NETWORK=baklava
%mainnet: NETWORK=mainnet
%development: NETWORK=development

deploy-function:
	  @gcloud functions deploy $(GCP_PROJECT)-${NETWORK} \
		  --entry-point=main \
		  --trigger-http \
		  --quiet \
		  --service-account=$(shell gcloud projects describe ${GCP_PROJECT} --format="get(projectNumber)")-compute@developer.gserviceaccount.com \
		  --project=${GCP_PROJECT} \
		  --memory=1024MB \
		  --runtime=nodejs12 \
		  --timeout=360 \
		  --update-env-vars=ENV_FILE=$(NETWORK),GCP_PROJECT=$(GCP_PROJECT) \
		  --source ./build \
		  --max-instances=3

ensure-network-set:
	@test -n "$(NETWORK)" || (echo "NETWORK not set" && exit 1)

# run locally
development: ENV_FILE=development
development: install clean
	@test -n "$(ENV_FILE)" || (echo "ENV_FILE not set" && exit 1)
	@sh -c 'GCP_PROJECT=$(GCP_PROJECT) ENV_FILE=$(ENV_FILE) npm run watch'

install:
	@yarn

# run tests
test:
	@yarn lint && yarn test

build: clean test
	@yarn build

clean:
	@rm -rf build/*

deploy deploy-baklava deploy-mainnet: ensure-network-set install build deploy-function

get-configuration get-configuration-baklava get-configuration-mainnet: ensure-network-set
	@curl -H "Authorization: bearer $(shell gcloud auth print-identity-token)" \
	  https://$(REGION)-$(GCP_PROJECT).cloudfunctions.net/$(GCP_PROJECT)-$(NETWORK)/configuration

current-status current-status-baklava current-status-mainnet: ensure-network-set
	@curl -H "Authorization: bearer $(shell gcloud auth print-identity-token)" \
	  https://$(REGION)-$(GCP_PROJECT).cloudfunctions.net/$(GCP_PROJECT)-$(NETWORK)/current-status

create-revision create-revision-baklava create-revision-mainnet: ensure-network-set
	@curl -H "Authorization: bearer $(shell gcloud auth print-identity-token)" \
	  https://$(REGION)-$(GCP_PROJECT).cloudfunctions.net/$(GCP_PROJECT)-$(NETWORK)/create-revision

backfill backfill-baklava backfill-mainnet: ensure-network-set
	@test -n "$(FROM_EPOCH)" || (echo "FROM_EPOCH not set" && exit 1)
	@test -n "$(TO_EPOCH)" || (echo "TO_EPOCH not set" && exit 1)
	@curl -H "Authorization: bearer $(shell gcloud auth print-identity-token)" \
	  https://$(REGION)-$(GCP_PROJECT).cloudfunctions.net/$(GCP_PROJECT)-$(NETWORK)/initiate-backfill?fromEpoch=$(FROM_EPOCH)&toEpoch=$(TO_EPOCH)

process-epoch process-epoch-baklava process-epoch-mainnet: ensure-network-set
	@test -n "$(EPOCH)" || (echo "EPOCH not set" && exit 1)
	@curl -H "Authorization: bearer $(shell gcloud auth print-identity-token)" \
	  https://$(REGION)-$(GCP_PROJECT).cloudfunctions.net/$(GCP_PROJECT)-$(NETWORK)/backfill-epoch?epoch=$(EPOCH)

reconcile reconcile-baklava reconcile-mainnet: ensure-network-set
	@curl -H "Authorization: bearer $(shell gcloud auth print-identity-token)" \
	  https://$(REGION)-$(GCP_PROJECT).cloudfunctions.net/$(GCP_PROJECT)-$(NETWORK)/reconcile?epoch=$(EPOCH)

new-project-setup:
	@gcloud services enable compute.googleapis.com --project=$(GCP_PROJECT)
	@gcloud services enable bigquery.googleapis.com --project=${GCP_PROJECT}
	@gcloud services enable cloudfunctions.googleapis.com --project=${GCP_PROJECT}
	@cd terraform && GOOGLE_PROJECT=$(GCP_PROJECT) terraform init && GOOGLE_PROJECT=$(GCP_PROJECT) terraform apply

.PHONY: all $(MAKECMDGOALS)
