import {XMLParser} from "fast-xml-parser";


// - - - - - - - - - - - - - - - - - - - - - - - - - types
type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
    item: RSSItem[];
  };
};

type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};


// - - - - - - - - - - - - - - - - - - - - - - - - - core
export async function fetchFeed(feedURL: string): Promise<RSSFeed>{
    const response = await fetch(feedURL, {
        headers: {"User-Agent": "gator"}
    });
    const xmlResult = await response.text();
    const parser = new XMLParser({processEntities: false});
    const jsResult = parser.parse(xmlResult);
    
    // channel
    const rawChannel = jsResult?.rss?.channel; 
    if (!rawChannel) {
      throw new Error("RSS feed missing rawChannel");
    }

    const title = rawChannel?.title;
    const link = rawChannel?.link;
    const description = rawChannel?.description;
    if (!title || !link || !description) {
      throw new Error("Invalid RSS feed metadata");
    }
    const channel:RSSFeed['channel'] = {
      title: title,
      description: description,
      link: link,
      item: []
    }

    // items
    let rawItems: any[]  = []
    if(rawChannel?.item){
      if(Array.isArray(rawChannel?.item)){
        rawItems = rawChannel?.item
      }
      else{
        rawItems = [rawChannel?.item];
      }
    }

    let items: RSSItem[]  = []
    for(let x of rawItems){
      if(x.title && x.link && x.description && x.pubDate){
        items.push({
          title: x.title,
          link: x.link, 
          description: x.description,
          pubDate: x.pubDate
        })
      }
    }

    channel.item = items
    const result:RSSFeed = {
      channel: channel,
    }

    return result;
    
}
