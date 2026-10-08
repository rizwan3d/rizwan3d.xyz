---
title: "How I Organise My Downloads Folder With .Net Core (C# Automation)"
slug: "how-i-organise-my-downloads-folder-with-net-core-c-automation"
created: "2019-12-23"
updated: "2019-12-23"
category: "software-engineering"
description: "Organising a cluttered Downloads folder automatically with .NET Core, FileSystemWatcher, file-type and date-based folders, configuration, and logging."
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d/how-i-organise-my-downloads-folder-with-net-core-c-automation-18445ef4279f"
canonicalUrl: "https://medium.com/@rizwan3d/how-i-organise-my-downloads-folder-with-net-core-c-automation-18445ef4279f"
originalTitle: "How I Organise My Downloads Folder With .Net Core (C# Automation)"
originalPublished: "2019-12-23"
author: "Muhammad Rizwan"
tags: "software-engineering, automation, programming, dotnet, csharp, filesystemwatcher"
featuredImage: "https://images.unsplash.com/photo-1461360228754-6e81c478b882"
sourceImageCredit: "Mr Cup / Fabien Barral on Unsplash"
sourceImageCreditUrl: "https://unsplash.com/@iammrcup"
importMethod: "medium-article-paraphrase"
importedAt: "2026-10-08"
featured: true
---

Recently, I felt overly annoyed by my messy download folder on my personal computer. There were too many files, and it was in a total mess. I thought to write a simple bot to address this problem.

## The Solution

Solution is a Bot that loops the download,desktop or any other folder and determines the file type for each and every file. Subsequently, it creates a folder for that file type. All files with the same file type will be transferred to this folder and or Organise by Date.

We use .Net Core to make it cross platform. but same code work well for .Net Framework ,.Net Standard and on Xamarin so it work on every popular device today.

## Start

Create a console application and set up Git:

```bash
dotnet new console -o FileOrganizer
cd FileOrganizer
git init
git add .
```

## Working

.Net provide FileSystemWatcher to watch for changes in a specified directory. You can watch for changes in files and sub directories of the specified directory. You can create a component to watch files on a local computer, a network drive, or a remote computer.

The FileSystemWatcher does not raise events for CDs and DVDs, because time stamps and properties cannot change. Remote computers must have one of the required platforms installed for the component to function properly.

```csharp
using (FileSystemWatcher watcher = new FileSystemWatcher())
{
    watcher.Path = WatchPath;
    watcher.Filter = "*.*";
    watcher.NotifyFilter = NotifyFilters.FileName | NotifyFilters.CreationTime;

    watcher.Created += OnCreated;
    watcher.EnableRaisingEvents = true;

    Console.WriteLine("Press 'q' to quit.");
    while (Console.Read() != 'q') ;
}

private static void OnCreated(object sender, FileSystemEventArgs e)
{
}
```

## Move File

we make directory in Organised path such as File Type , year , Mount and then date.

```csharp
private static void OnCreated(object sender, FileSystemEventArgs e)
{
    string watchFilePath = e.FullPath;

    string Extension = Path.GetExtension(watchFilePath).Substring(1);
    if (orgSubPaths.ContainsKey(Extension.ToLower()))
    {
        MoveFile(watchFilePath, orgSubPaths[Extension.ToLower()],Extension);
    }
    else
    {
        MoveFile(watchFilePath, "UnKnown",Extension);
    }
}

private static void MoveFile(string watchFilePath, string orgSubPath,string Extension)
{
    DateTime now = DateTime.Now;
    string year = now.Year.ToString();
    string month = now.ToString("MMMM");
    string day = now.ToString("dd");

    string FileName = Path.GetFileName(watchFilePath);
    string path2ndPart = $@"{orgSubPath}\{year}\{month}\{day}\";
    string FullDirectoryPath = Path.Combine(OrgPath, path2ndPart);

    Directory.CreateDirectory(FullDirectoryPath);          

    File.Move(watchFilePath, OrgEdPath);
}
```

## Error One: Duplicate Names

it work fine but when it overwrite file with same name, so we add check.

```csharp
string OrgEdPath = Path.Combine(FullDirectoryPath, FileName);
if(File.Exists(OrgEdPath)){
    FileName  = $"{Path.GetFileNameWithoutExtension(OrgEdPath)}-{now.Minute}{now.Second}.{Extension}";
    OrgEdPath = Path.Combine(FullDirectoryPath, FileName);
}
```

## Error Two: Files in Use

when file is other press it throw exception to overcome this problem we try to reach file until file is open to move.

```csharp
private static bool IsFileLocked(string FilePath, bool del = false)
{
    bool locked = false;
    try{
        FileStream fs = File.Open(FilePath,FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);
        fs.Close();
        if(del)
            File.Delete(FilePath);
    }
    catch(Exception){
        locked = true;
    }
    return locked;
}

//so add new lines in MoveFile function.
while(IsFileLocked(watchFilePath) || IsFileLocked(OrgEdPath,true));
  File.Move(watchFilePath, OrgEdPath);
```

## Addition: Configuration and Logging

so we have to add configuration file to add or update information with out making changes in code and generate logs of files with time.

```csharp
string[] Config = File.ReadAllLines("Config.csv");

WatchPath = Config[0].Split(',')[1];
OrgPath = Config[1].Split(',')[1];

orgSubPaths = new Dictionary<string, string>();
for(int i = 2;i < Config.Length;i++)
{
    string[] ExtensionOrgSubPath = Config[i].Split(',');
    orgSubPaths.Add(ExtensionOrgSubPath[0], ExtensionOrgSubPath[1]);
}
            
//Add this to end of MoveFunction
File.AppendAllText("Log.csv",$"{now},{watchFilePath},{OrgEdPath}{Environment.NewLine}");
```

## Config File

Keep folder paths, organisation preferences, and related options in external configuration.

```csv
WatchPath,D:\test\watch
OrgPath,D:\test\org
txt,Word processor and text file
zip,Compressed file
7z,Compressed file
rar,Compressed file
csv,Data and database file
bmp,Image file
gif,Image file
jpeg,Image file
jpg,Image file
png,Image file
doc,Word processor and text file
docx,Word processor and text file
rtf,Word processor and text file
mkv,Video file
mp4,Video file
```

## YouTube Video

:::url-preview
https://www.youtube.com/watch?v=0e_oliJMlhs
:::

## Project

:::url-preview
https://github.com/rizwan3d/FileOrganizer
:::
