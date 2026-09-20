/*!
\group		CtrlAlt
\file       SceneManager.cpp
\author     Jerron Teng
\par        t.junrongjerron@digipen.edu
\date       Sep 17, 2024
\brief

This file defines the `SceneManager` class, which is responsible for managing multiple scenes in an ECS system.
It allows for adding, switching, and updating scenes, as well as serializing scene data.
*/

// INCLUDES
// =========================================================================================================
#include "../src/pch.h"
#include "SceneManager.h"
#include <algorithm>
#include <fstream>
#include <filesystem>
#include <iomanip>
#include <sstream>

#include "../ECS/ECS.h"
#include "../Logger/Logger.h"
#include "../Components/CRigidBody.h"
#include "../Components/CTransform.h"
#include "../Components/CIdentifier.h"
#include "../Render/Render.h"
#include "../Logger/Logger.h"

#include "../Application/App.h" // For MonoEngine.
#include "../PrefabsManager/PrefabManager.h" // for prefab manager,

#include "./GameRunTime/LevelData.h"

namespace CtrlAltEngine
{
	namespace SceneManagement
	{
		/*!
		@brief Constructor for SceneManager class
		Special scenarios: -
		@param -
		@return -
		\*________________________________________________________________*/
		SceneManager::SceneManager(EntityManagement::EntityManager& _entityManager) :
			serializer(),//(_entityManager.GetRegistry(), _entityManager),
			entityManager(_entityManager),
			currentScene(nullptr),
			isSceneLoaded(false),
			isSceneUnloaded(false)
		{};


		void SceneManager::Initialize()
		{
			///////////////////
			// GAME STUFF
			// ///////////////
			Game::ParseGameLevels();
			// Initialize masterSceneList from the master scene file
			std::fstream file{ filepath, std::ios::in };

			if (!file)
			{
				Logger::LogInfo("File \"Master Scene\" not found.");
				std::ofstream createFile(filepath);
				if (createFile)
					Logger::LogInfo("File \"Master Scene\" created.");
				else
					Logger::LogInfo("File \"Master Scene\" can't be created.");
			}
			else
			{
				Logger::LogInfo("File \"Master Scene\" opened.");
				std::string buffer;
				std::stringstream ss;
				int index = 0;
				while (std::getline(file, buffer))
				{
					Scene scene;
					ss << buffer;
					ss >> scene.sceneName;
					ss >> scene.entityCount;
					scene.sceneId = index++;
					masterSceneList.push_back(scene); // Populate masterSceneList
					ss.clear();
				}

				Logger::LogInfo("(" + std::to_string(index) + ") Master Scene files loaded.");
			}
			file.close();

			// Initialize sceneList by reading all available scenes in the directory
			std::string sceneDirectory = "Assets/Scenes/";
			try
			{
				for (const auto& entry : std::filesystem::directory_iterator(sceneDirectory))
				{
					if (entry.is_regular_file())
					{
						std::string filename = entry.path().filename().string();

						// Extract scene name (without extension) and construct a Scene object
						size_t extensionPos = filename.find_last_of('.');
						std::string sceneName = (extensionPos != std::string::npos) ? filename.substr(0, extensionPos) : filename;

						Scene scene{ sceneName, static_cast<int>(sceneList.size()), 0 }; // Entity count initialized as 0
						sceneList.push_back(scene);
					}
				}
			}
			catch (const std::filesystem::filesystem_error& e)
			{
				Logger::LogInfo("Error accessing scene directory: " + std::string(e.what()));
			}

			Logger::LogInfo(std::to_string(sceneList.size()) + " scenes loaded from directory.");

			// Set currentScene if scenes are available
			if (!masterSceneList.empty())
			{
				currentScene = &masterSceneList[0];
				Logger::LogInfo("Current scene set to: " + currentScene->sceneName);
				//LoadScene(currentScene->sceneName);
				sceneToLoad.push(*currentScene);
			}
			else
			{
				Logger::LogInfo("No scenes found in directory. Creating default scene.");
				CreateScene(); // Create a new default scene if no scenes are found
			}

			// Scene Management via entity hiarchy.
			//this->entityManager.CreateBaseRootEntity(); // assume that this will be entity id 0;
		}// end of initialised.

		void SceneManager::LoadScene(std::string const sceneName)
		{
			auto it = std::find_if(sceneList.begin(), sceneList.end(),
				[&sceneName](Scene& scene)
				{
					// Extract scene name without the extension
					size_t pos = scene.sceneName.find_last_of('.');
					std::string filename = (pos != std::string::npos) ? scene.sceneName.substr(0, pos) : scene.sceneName;
					return filename == sceneName;
				});

			if (it == sceneList.end())
			{
				Logger::LogInfo("Scene \"" + sceneName + "\" does not exist in sceneList.");
				return;
			}

			// Load the scene using its index
			int index = static_cast<int>(std::distance(sceneList.begin(), it));
			Logger::LogInfo("size of sceneList = " + std::to_string(sceneList.size()) + "size of masterList = " + std::to_string(masterSceneList.size()));
			Logger::LogInfo(std::to_string(index) + "index <-"); // should be to_string
			LoadScene(index);
		}


		void SceneManager::LoadScene(int index)
		{
			if (index < 0 || index >= static_cast<int>(sceneList.size()))
			{
				Logger::LogInfo("No such scene found. Index (" + std::to_string(index) + ") is out of bounds.");
				return;
			}

			// Set the new current scene
			currentScene = &sceneList[index];
			entityManager.CreateRootEntity(); 
			//entityManager.CreateSceneRootEntity(currentScene->sceneName); // this is the scene's entity.
			//// parent it.
			//entityManager.SetParent(entityManager.GetSceneRootEntity(currentScene->sceneName), entityManager.GetBaseRootEntity());
			Logger::LogInfo("LoadScene called with index: " + std::to_string(index));
			Logger::LogInfo("Current scene set to: " + currentScene->sceneName);

			// Deserialize the scene
			unsigned int noOfEntitiesDeserialized = this->serializer.Deserialize(
				currentScene->sceneName,
				this->entityManager.GetEntityList()
			);

			Logger::LogInfo("Scene \"" + currentScene->sceneName + "\" loaded with " +
				std::to_string(noOfEntitiesDeserialized) + " entities.");

			Sounds::SoundManager::StopAllSounds();
		}

		void SceneManager::UnloadScene()
		{
			entityManager.UnloadEntities(); 
			Logger::LogInfo("Scene \"" + currentScene->sceneName + "\" unloaded.");
			isSceneUnloaded = true;
		}

		void SceneManager::CreateScene()
		{
			// Log current scene unloading
			if (currentScene != nullptr)
			{
				Logger::LogInfo("Unloading current scene: " + currentScene->sceneName);
			}

			std::string defaultName{ "default_scene" };
			int count{ 1 };

			// Determine a unique name for the new scene
			std::string sceneDirectory = "Assets/Scenes/";
			try
			{
				for (const auto& entry : std::filesystem::directory_iterator(sceneDirectory))
				{
					if (entry.is_regular_file())
					{
						std::string filename = entry.path().filename().string();
						if (filename.find(defaultName) != std::string::npos)
						{
							count++;
						}
					}
				}
			}
			catch (const std::filesystem::filesystem_error& e)
			{
				Logger::LogInfo("Error accessing directory: " + std::string(e.what()));
			}

			if (count > 1)
			{
				defaultName += std::to_string(count);
			}

			Scene newScene{ defaultName, static_cast<int>(sceneList.size()), 0 };
			sceneList.push_back(newScene);
			currentScene = &sceneList.back();

			Logger::LogInfo("Created new scene: " + defaultName);

			SaveScene();
			Scene toLoad = sceneList.at(sceneList.size() - 1);
			//LoadScene(static_cast<int>(); // Load the new scene
			QueueSceneToLoad(toLoad);
		}



		/*!
		@brief Function call to add a scene to the Editor given a filename and the filepath
		Special scenarios: -
		@param const std::string& name, const std::string& filePath
		@return -
		\*________________________________________________________________*/
		void SceneManager::AddScene(const std::string& name, const std::string& path)
		{
			std::fstream file{ path, std::ios::in };

			if (file.fail())
			{
				Logger::LogInfo("Scene \"" + name + "\" not found at " + path);
				return;
			}

			std::string keyword{ "CTransform" };
			std::string buffer;
			int entityCount = 0;

			while (std::getline(file, buffer))
			{
				size_t pos = 0;
				while ((pos = buffer.find(keyword, pos)) != std::string::npos)
				{
					++entityCount;
					pos += keyword.length();
				}
			}

			file.close();

			auto it = std::find_if(masterSceneList.begin(), masterSceneList.end(),
				[&name](const Scene& scene) { return scene.sceneName == name; });

			if (it != masterSceneList.end())
			{
				Logger::LogInfo("Scene \"" + name + "\" already exists in masterSceneList.");
				return;
			}

			Scene newScene{ name, static_cast<int>(masterSceneList.size()), entityCount };
			masterSceneList.push_back(newScene);

			Logger::LogInfo("Scene \"" + name + "\" added to masterSceneList.");
			SaveMasterData();
		}


		void SceneManager::SaveMasterData()
		{
			std::fstream file{ filepath, std::ios::out | std::ios::trunc };

			Logger::LogInfo("Saving " + std::to_string(masterSceneList.size()) + " scenes to master scene file.");

			for (const auto& scene : masterSceneList)
			{
				file << scene.sceneName << " " << scene.entityCount << std::endl;
				Logger::LogInfo("Scene \"" + scene.sceneName + "\" saved with " + std::to_string(scene.entityCount) + " entities.");
			}

			file.close();
		}


		/*!
		@brief Function to serialize data to a file, called by Editor
		Special scenarios: -
		@param -
		@return -
		\*________________________________________________________________*/
		void SceneManager::SaveScene()
		{
			// this serialise the current scene's ECS data.
			this->serializer.Serialize(this->currentScene->sceneName, this->entityManager.GetEntityList()); // do this function.
			// Logger::LogInfo("Saving Scene Successful...");
			
			// This only saves scene data, does not affect MasterData
			// SaveMasterData();

		}

		void SceneManager::ReloadScene()
		{
			//LoadScene(currentScene->sceneId);
			sceneToLoad.push(* currentScene);
		}

		/*!
		@brief To remove a scene when given scene
		Special scenarios: -
		@param -
		@return -
		\*________________________________________________________________*/
		void SceneManager::RemoveScene(const std::string& sceneName)
		{
			// Find the scene in the masterSceneList
			auto it = std::find_if(masterSceneList.begin(), masterSceneList.end(),
				[&sceneName](const Scene& scene) { return scene.sceneName == sceneName; });

			if (it != masterSceneList.end())
			{
				Logger::LogInfo("Removing scene: " + sceneName + " from masterSceneList.");

				// Erase the scene from the masterSceneList
				masterSceneList.erase(it);

				for (int i = 0; i < sceneList.size(); i++)
				{
					sceneList[i].sceneId = i;
				}

				// Update the master scene file
				// SaveMasterData();
				// Jerron : No longer update the master scene from here, SaveMasterData() to be called only upon exit or manually saving

				Logger::LogInfo("Scene \"" + sceneName + "\" successfully removed and master scene file updated.");
			}
			else
			{
				Logger::LogInfo("Scene \"" + sceneName + "\" not found in masterSceneList.");
			}
		}

		void SceneManager::QueueSceneToLoad(Scene scene)
		{
			if (currentScene)
				sceneToUnload.push(*currentScene);

			sceneToLoad.push(scene);
		}

		void SceneManager::QueueSceneToLoad(const int scene_num)
		{
			if ((size_t)scene_num > sceneList.size())
				return;

			if (currentScene)
				sceneToUnload.push(*currentScene);

			sceneToLoad.push(sceneList[scene_num]);
		}

		void SceneManager::QueueSceneToLoad(std::string name)
		{
			auto it = std::find_if(sceneList.begin(), sceneList.end(), [&](Scene const& scene)
				{
					std::string nm = scene.sceneName;
					return (nm == name);
				});

			if (it == sceneList.end())
				return;

			if (currentScene)
				sceneToUnload.push(*currentScene);

			sceneToLoad.push(*it);
		}


		/*!
		@brief Editor to call UpdateScene
		Special scenarios: -
		@param -
		@return -
		\*________________________________________________________________*/
		void SceneManager::Update()
		{
			isSceneUnloaded = false;
			isSceneLoaded = false;

			if (!sceneToUnload.empty())
			{
				//ECS::PrefabManager::GetInstance().DeletePrefab("Projectile"); // has to delete before Serializer and EM does it jobs
				UnloadScene(); // w.r.t ECS, Registry, EM,
				Global::engineMonoScript->FreeMonoObjectsMap(); 
				// clear the prefab, !! NOT THE INTENDED WAY AND ALSO NEED TO SET UP DESERIALISING OF PREFAB.
				
				sceneToUnload.pop();
				isSceneUnloaded = true;
				return;
			}

			if (!sceneToLoad.empty())
			{
				LoadScene(sceneToLoad.front().sceneName);
				sceneToLoad.pop();
				isSceneLoaded = true;
			}
		}


		/*!
		@brief Returns current Scene
		Special scenarios: -
		@param -
		@return -
		\*________________________________________________________________*/
		Scene const& SceneManager::GetCurrentScene()
		{
			return *currentScene;
		}

		Serialization::Serializer& SceneManager::GetSerializer()
		{
			return serializer;
		}

		std::vector<Scene>& SceneManager::GetSceneList()
		{
			return sceneList;
		}

		std::vector<Scene>& SceneManager::GetMasterSceneList()
		{
			return masterSceneList;
		}

		bool SceneManager::IsSceneUnloaded()
		{
			return isSceneUnloaded;
		}

		bool SceneManager::IsSceneLoaded()
		{
			return isSceneLoaded;
		}
	}
}
