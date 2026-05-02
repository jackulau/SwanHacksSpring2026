import { RecordModel } from "pocketbase";

export interface Item extends RecordModel {
  name: string;
  description: string;
}
