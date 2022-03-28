import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Db, MongoClient, ObjectId } from "mongodb";
import { ImPlatformType, RepoPlatformType, WatchScopeType } from "src/types/common";
import {
  ACTIVITY_WATCHERS,
  EVENT_LOGS,
  PR_ACTIVITY_WATCHERS,
  USER_ACCESS_TOKEN,
  USER_IM_ACCOUNT_DATA,
} from "./collection-names";
import {
  IActivityWatchers,
  IEventLog,
  IIssueActivityWatchers,
  IPrActivityWatchers,
  IUserAccessTokens,
  IUserImAccountData,
} from "./types";

interface IGetUserAccessTokenArgs {
  userId: ObjectId;
  platform: RepoPlatformType;
}

interface IGetUserImDataArgs {
  imPlatform?: ImPlatformType;
  userId?: ObjectId;
  imPlatformId?: string;
  devPlatformId?: string;
  imPlatformName?: ImPlatformType;
}

@Injectable()
export class DataService {
  private mongo: MongoClient;
  private db: Db;
  private logger: Logger;

  constructor(private config: ConfigService) {
    this.mongo = new MongoClient(this.config.get("DB.URI"));
    this.mongo.connect();
    this.logger = new Logger(DataService.name);

    this.db = this.mongo.db(this.config.get("DB.database"));
  }

  public async getUserAccessToken({ userId, platform }: IGetUserAccessTokenArgs) {
    const collection = this.db.collection<IUserAccessTokens>(USER_ACCESS_TOKEN);
    const data = await collection.findOne({
      userId,
      platform,
    });
    return data;
  }

  public async getUserImData<EXTRA_TYPE = never>(args: IGetUserImDataArgs) {
    const imCollection = this.db.collection<IUserImAccountData<EXTRA_TYPE>>(USER_IM_ACCOUNT_DATA);
    if (args.userId) {
      return imCollection.find({ userId: args.userId, platformName: args.imPlatformName }).toArray();
    } else if (args.devPlatformId) {
      const atCollection = this.db.collection<IUserAccessTokens>(USER_ACCESS_TOKEN);
      const user = await atCollection.findOne({
        platformId: args.devPlatformId,
      });
      if (!user) {
        this.logger.error(`Unable to find user by devPlatformId ${args.devPlatformId}`);
        throw new Error(`Unable to find user by devPlatformId ${args.devPlatformId}`);
      }
      return imCollection.find({ userId: user.userId, platformName: args.imPlatformName }).toArray();
    } else if (args.imPlatformId) {
      return imCollection
        .find({
          platformId: args.imPlatformId,
          platformName: args.imPlatformName,
        })
        .toArray();
    }
  }

  public async getActivityWatchers(userId?: ObjectId, scope?: WatchScopeType) {
    const collection = this.db.collection<IActivityWatchers>(ACTIVITY_WATCHERS);
    return collection.find({ userId, scope }).toArray();
  }

  public async getPrWatchers(prNumber: number, platform: RepoPlatformType) {
    const collection = this.db.collection<IPrActivityWatchers>(PR_ACTIVITY_WATCHERS);
    return collection.find({ prNumber, repoPlatform: platform }).toArray();
  }

  public async getIssueWatchers(issueNumber: number, platform: RepoPlatformType) {
    const collection = this.db.collection<IIssueActivityWatchers>(PR_ACTIVITY_WATCHERS);
    return collection.find({ issueNumber, repoPlatform: platform }).toArray();
  }

  public async logEvent(platform: string, event: string, payload: string) {
    const collection = this.db.collection<IEventLog>(EVENT_LOGS);
    await collection.insertOne({ platform, event, payload });
  }
}
