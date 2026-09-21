/*!
\group		CtrlAlt
\file       SceneManager.h
\author     Jerron Teng
\par        t.junrongjerroni@digipen.edu
\date       Sep 17, 2024
\brief

This file declares the `SceneManager` class, which is responsible for managing multiple scenes in an ECS system.
It allows for adding, switching, and updating scenes, as well as serializing scene data.
*/
#ifndef SCENEMANAGER_H
#define SCENEMANAGER_H

// INCLUDES
// =========================================================================================================
#include <unordered_map>
#include <memory>
#include <string>

#include "../EntityManager/EntityManager.h"
#include "../ECS/ECS.h"
#include "../Components/CRigidBody.h"
#include "../Components/CTransform.h"
#include "../Components/CIdentifier.h"
#include "Scene.h"

#include "../Serialization/Serialization.h"
#include "../Systems/SLogic.h"

namespace CtrlAltEngine
{
	namespace SceneManagement
	{
		class SceneManager
		{
		private:
			std::string const filepath{ "Resources/Scenes/MasterScene.txt" };
			std::vector<Scene> sceneList;
			std::vector<Scene> masterSceneList;
			Scene* currentScene;
			Serialization::Serializer serializer; // Sherman: could be a unique_ptr . but idn cleaning.

			EntityManagement::EntityManager& entityManager;
			bool isSceneUnloaded;
			bool isSceneLoaded;
			std::queue<Scene> sceneToUnload;
			std::queue<Scene> sceneToLoad;

		public:
			/*!
			@brief Constructor for SceneManager class
			Special scenarios: -
			@param -
			@return -
			\*________________________________________________________________*/
			SceneManager(EntityManagement::EntityManager&);

			void Initialize();
			void LoadScene(std::string const);
			void LoadScene(int scene = -1);
			void UnloadScene();
			void CreateScene();

			/*!
			@brief Function call to add a scene to the Editor given a filename and the filepath
			Special scenarios: -
			@param const std::string& name, const std::string& filePath
			@return -
			\*________________________________________________________________*/
			void AddScene(const std::string& name, const std::string& filepath);

			/*!
			@brief Function to serialize scene master data
			Special scenarios: -
			@param -
			@return -
			\*________________________________________________________________*/
			void SaveMasterData();

			/*!
			@brief Function to serialize data to a file, called by Editor
			Special scenarios: -
			@param -
			@return -
			\*________________________________________________________________*/
			void SaveScene();

			/*!
			@brief Function to Reload the same scene
			Special scenarios: -
			@param -
			@return -
			\*________________________________________________________________*/
			void ReloadScene();
			/*!
			@brief To remove a scene when given scene
			Special scenarios: -
			@param -
			@return -
			\*________________________________________________________________*/
			void RemoveScene(const std::string&);

			/*!
			@brief
			Special scenarios: -
			@param -
			@return -
			\*________________________________________________________________*/
			void Update();

			/*!
			@brief Returns current Scene
			Special scenarios: -
			@param -
			@return -
			\*________________________________________________________________*/
			Scene const& GetCurrentScene();

			void QueueSceneToLoad(Scene scene);
			void QueueSceneToLoad(const int scene_num);
			void QueueSceneToLoad(std::string scene_name);

			Serialization::Serializer& GetSerializer();
			std::vector<Scene>& GetSceneList();
			std::vector<Scene>& GetMasterSceneList();

			bool IsSceneUnloaded();
			bool IsSceneLoaded();

		};
	}
}


#endif